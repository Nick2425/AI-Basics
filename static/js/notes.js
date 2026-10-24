/**
 * NeuroSoma - Sticky Notes & Hierarchical Anatomy Tree Controller
 *
 * Implements:
 * - File-system-style hierarchical anatomy tree grouped by systems and subcategories
 * - Expandable/collapsible folders with item and note count badges
 * - Floating sticky note card anchored to 3D structures in viewport
 * - Dynamic note previews and indicators in tree
 * - localStorage persistence (discarding blank drafts)
 * - Pre-loads 1 sample note on first launch (Vagus Nerve)
 *
 * Depends on: NeuroViewport (viewport.js)
 * Exposes:    window.NeuroNotes
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'neurosoma_notes';
    var SAMPLE_SEED_KEY = 'neurosoma_seeded_v1';

    // State
    var notesMap = {}; // { [structureId]: string }
    var currentStructure = null;
    var currentAnchor3D = null;
    var cachedStructures = null;
    var collapsedFolders = {}; // { [folderId]: boolean }

    // DOM Elements
    var cardEl, titleEl, tagEl, textareaEl, closeBtn, deleteBtn, saveBtn;
    var treeEl, countBadgeEl;

    /* ================================================================
       Initialization
       ================================================================ */
    function init() {
        cardEl       = document.getElementById('sticky-note-card');
        titleEl      = document.getElementById('sticky-title');
        tagEl        = document.getElementById('sticky-tag');
        textareaEl   = document.getElementById('sticky-textarea');
        closeBtn     = document.getElementById('sticky-close-btn');
        deleteBtn    = document.getElementById('sticky-delete-btn');
        saveBtn      = document.getElementById('sticky-save-btn');
        treeEl       = document.getElementById('notes-tree');
        countBadgeEl = document.getElementById('notes-count-badge');

        loadNotes();
        setupEventListeners();

        // Load structure hierarchy
        ensureStructures(function () {
            renderTree();
        });

        // Connect to Viewport selection events
        if (window.NeuroViewport) {
            NeuroViewport.onSelect(function (structure, screenPos, anchor3D) {
                openNote(structure, screenPos, anchor3D);
            });

            NeuroViewport.onDeselect(function () {
                closeNote(true); // auto-save on outside click
            });
        }
    }

    function ensureStructures(callback) {
        if (cachedStructures && cachedStructures.length > 0) {
            if (callback) callback(cachedStructures);
            return;
        }

        if (window.NeuroViewport && NeuroViewport.getAnatomyData()) {
            cachedStructures = NeuroViewport.getAnatomyData();
            if (callback) callback(cachedStructures);
            return;
        }

        fetch('/api/anatomy')
            .then(function (res) { return res.json(); })
            .then(function (data) {
                cachedStructures = data.structures || [];
                if (callback) callback(cachedStructures);
            })
            .catch(function (err) {
                console.error('[NeuroNotes] Failed to fetch anatomy for tree:', err);
                if (callback) callback([]);
            });
    }

    /* ================================================================
       Storage & Seed
       ================================================================ */
    function loadNotes() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                notesMap = JSON.parse(raw);
            }
        } catch (e) {
            console.error('[NeuroNotes] Error reading localStorage:', e);
            notesMap = {};
        }

        // Seed 1 sample note on initial launch
        if (!localStorage.getItem(SAMPLE_SEED_KEY) && Object.keys(notesMap).length === 0) {
            notesMap['vagus_nerve'] = 'Cranial nerve X provides parasympathetic innervation to thoracic organs and cardiac plexus. Modulates vagal tone and resting heart rate.';
            saveToStorage();
            localStorage.setItem(SAMPLE_SEED_KEY, 'true');
        }
    }

    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notesMap));
        } catch (e) {
            console.error('[NeuroNotes] Error saving to localStorage:', e);
        }
        updateBadge();
    }

    function updateBadge() {
        if (!countBadgeEl) return;
        var count = Object.keys(notesMap).filter(function (id) {
            return notesMap[id] && notesMap[id].trim().length > 0;
        }).length;
        countBadgeEl.textContent = count + (count === 1 ? ' note' : ' notes');
    }

    /* ================================================================
       Event Listeners
       ================================================================ */
    function setupEventListeners() {
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                closeNote(true);
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                saveCurrentNote();
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', function () {
                if (currentStructure) {
                    deleteNote(currentStructure.id);
                    if (textareaEl) textareaEl.value = '';
                    closeNote(false);
                }
            });
        }

        // Prevent clicking inside the note card from propagating to viewport orbit
        if (cardEl) {
            cardEl.addEventListener('pointerdown', function (e) {
                e.stopPropagation();
            });
            cardEl.addEventListener('click', function (e) {
                e.stopPropagation();
            });
        }
    }

    /* ================================================================
       Open & Close Floating Sticky Note
       ================================================================ */
    function openNote(structure, screenPos, anchor3D) {
        if (!cardEl || !structure) return;
        currentStructure = structure;
        currentAnchor3D = anchor3D;

        // Populate card content
        titleEl.textContent = structure.name || 'Structure';
        tagEl.textContent = structure.tag || ('[' + structure.category + ']');
        tagEl.className = 'sticky-tag';
        if (structure.system === 'nervous') tagEl.classList.add('tag-nerve');
        else if (structure.category === 'Muscle') tagEl.classList.add('tag-muscle');
        else tagEl.classList.add('tag-bone');

        // Existing note text or empty
        var existingText = notesMap[structure.id] || '';
        textareaEl.value = existingText;

        // Position card near structure screen coordinates, bounded inside viewport
        positionCard(screenPos);

        cardEl.style.display = 'flex';
        textareaEl.focus();

        // Highlight active item in tree & auto-expand folder
        highlightTreeItem(structure.id);
    }

    function positionCard(screenPos) {
        if (!cardEl || !screenPos) return;
        var parent = cardEl.parentElement;
        if (!parent) return;

        var parentW = parent.clientWidth;
        var parentH = parent.clientHeight;
        var cardW = 290;
        var cardH = 210;

        var left = screenPos.x + 24;
        var top  = screenPos.y - 40;

        // Clamp boundaries
        if (left + cardW > parentW - 14) {
            left = screenPos.x - cardW - 24;
        }
        if (left < 14) left = 14;

        if (top + cardH > parentH - 14) {
            top = parentH - cardH - 14;
        }
        if (top < 14) top = 14;

        cardEl.style.left = Math.round(left) + 'px';
        cardEl.style.top  = Math.round(top)  + 'px';
    }

    function closeNote(shouldSave) {
        if (!cardEl || cardEl.style.display === 'none') return;

        if (shouldSave && currentStructure && textareaEl) {
            var text = textareaEl.value.trim();
            if (text.length > 0) {
                notesMap[currentStructure.id] = text;
                saveToStorage();
            } else {
                delete notesMap[currentStructure.id];
                saveToStorage();
            }
        }

        cardEl.style.display = 'none';
        currentStructure = null;
        currentAnchor3D = null;
        renderTree();
    }

    function saveCurrentNote() {
        if (!currentStructure || !textareaEl) return;
        var text = textareaEl.value.trim();
        if (text.length > 0) {
            notesMap[currentStructure.id] = text;
            saveToStorage();
        } else {
            delete notesMap[currentStructure.id];
            saveToStorage();
        }
        cardEl.style.display = 'none';
        renderTree();
    }

    function deleteNote(structureId) {
        if (notesMap[structureId]) {
            delete notesMap[structureId];
            saveToStorage();
            renderTree();
        }
    }

    /* ================================================================
       Hierarchical File-Tree Rendering
       ================================================================ */
    function renderTree() {
        if (!treeEl) return;
        updateBadge();

        ensureStructures(function (structures) {
            if (!structures || structures.length === 0) return;

            treeEl.innerHTML = '';
            var container = document.createElement('div');
            container.className = 'tree-container';

            // Filter groups
            var nervousStructures = structures.filter(function (s) {
                return s.system === 'nervous';
            });
            var muscleStructures = structures.filter(function (s) {
                return s.system === 'musculoskeletal' && s.category === 'Muscle';
            });
            var skeletalStructures = structures.filter(function (s) {
                return s.system === 'musculoskeletal' && s.category !== 'Muscle';
            });

            // 1. Nervous System Folder
            var nervousFolder = createFolderElement('nervous', 'Nervous System', nervousStructures.length);
            var nervousList = nervousFolder.querySelector('.tree-folder-children');
            nervousStructures.forEach(function (s) {
                nervousList.appendChild(createNodeElement(s));
            });
            container.appendChild(nervousFolder);

            // 2. Musculoskeletal System Folder
            var musculoFolder = createFolderElement('musculoskeletal', 'Musculoskeletal System', muscleStructures.length + skeletalStructures.length);
            var musculoList = musculoFolder.querySelector('.tree-folder-children');

            // 2a. Muscles Subfolder
            var musclesSubfolder = createFolderElement('muscles', 'Muscular Structures', muscleStructures.length);
            var musclesList = musclesSubfolder.querySelector('.tree-folder-children');
            muscleStructures.forEach(function (s) {
                musclesList.appendChild(createNodeElement(s));
            });
            musculoList.appendChild(musclesSubfolder);

            // 2b. Skeletal Framework Subfolder
            var skeletalSubfolder = createFolderElement('skeletal', 'Skeletal Framework', skeletalStructures.length);
            var skeletalList = skeletalSubfolder.querySelector('.tree-folder-children');
            skeletalStructures.forEach(function (s) {
                skeletalList.appendChild(createNodeElement(s));
            });
            musculoList.appendChild(skeletalSubfolder);

            container.appendChild(musculoFolder);
            treeEl.appendChild(container);

            if (currentStructure) {
                highlightTreeItem(currentStructure.id);
            }
        });
    }

    function createFolderElement(folderId, title, count) {
        var folder = document.createElement('div');
        folder.className = 'tree-folder';
        folder.setAttribute('data-folder-id', folderId);

        if (collapsedFolders[folderId]) {
            folder.classList.add('collapsed');
        }

        var header = document.createElement('div');
        header.className = 'tree-folder-header';
        header.innerHTML =
            '<span class="tree-chevron">▾</span>' +
            '<span class="tree-folder-title">' + escapeHtml(title) + '</span>' +
            '<span class="tree-folder-badge">' + count + '</span>';

        header.addEventListener('click', function () {
            folder.classList.toggle('collapsed');
            collapsedFolders[folderId] = folder.classList.contains('collapsed');
        });

        var children = document.createElement('div');
        children.className = 'tree-folder-children';

        folder.appendChild(header);
        folder.appendChild(children);
        return folder;
    }

    function createNodeElement(structure) {
        var id = structure.id;
        var node = document.createElement('div');
        node.className = 'tree-node';
        node.setAttribute('data-id', id);

        var tagClass = 'tag-nerve';
        if (structure.category === 'Muscle') tagClass = 'tag-muscle';
        else if (structure.system !== 'nervous') tagClass = 'tag-bone';

        var hasNote = (notesMap[id] && notesMap[id].trim().length > 0);
        var noteText = hasNote ? notesMap[id].trim() : '';

        var html =
            '<div class="tree-node-main">' +
                '<span class="tree-node-name">' + escapeHtml(structure.name) + '</span>' +
                '<div class="tree-node-meta">' +
                    '<span class="' + tagClass + '">' + escapeHtml(structure.tag) + '</span>' +
                    (hasNote ? '<span class="tree-note-indicator">[Note]</span>' : '') +
                    (hasNote ? '<button type="button" class="tree-note-delete" title="Delete note">×</button>' : '') +
                '</div>' +
            '</div>';

        if (hasNote) {
            html += '<div class="tree-note-preview">' + escapeHtml(noteText) + '</div>';
        }

        node.innerHTML = html;

        // Node click: select and inspect in 3D
        node.addEventListener('click', function (e) {
            if (e.target.classList.contains('tree-note-delete')) return;
            inspectStructureFromTree(id);
        });

        // Delete note button
        var delBtn = node.querySelector('.tree-note-delete');
        if (delBtn) {
            delBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteNote(id);
                if (window.NeuroViewport && NeuroViewport.getSelectedStructureId() === id) {
                    NeuroViewport.deselectStructure();
                }
            });
        }

        return node;
    }

    function highlightTreeItem(id) {
        if (!treeEl) return;
        var nodes = treeEl.querySelectorAll('.tree-node');
        nodes.forEach(function (n) {
            if (n.getAttribute('data-id') === id) {
                n.classList.add('active');
                // Ensure parent folders are expanded
                var parentFolder = n.closest('.tree-folder');
                while (parentFolder) {
                    parentFolder.classList.remove('collapsed');
                    var fid = parentFolder.getAttribute('data-folder-id');
                    if (fid) collapsedFolders[fid] = false;
                    parentFolder = parentFolder.parentElement ? parentFolder.parentElement.closest('.tree-folder') : null;
                }
            } else {
                n.classList.remove('active');
            }
        });
    }

    function inspectStructureFromTree(structureId) {
        if (window.NeuroViewport) {
            NeuroViewport.selectStructureById(structureId);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* ================================================================
       Public API
       ================================================================ */
    window.NeuroNotes = {
        init:         init,
        openNote:     openNote,
        closeNote:    closeNote,
        saveNote:     function (id, text) {
            if (text && text.trim().length > 0) {
                notesMap[id] = text.trim();
                saveToStorage();
            } else {
                deleteNote(id);
            }
            renderTree();
        },
        deleteNote:   deleteNote,
        getNotes:     function () { return Object.assign({}, notesMap); },
        getNoteCount: function () {
            return Object.keys(notesMap).filter(function (id) {
                return notesMap[id] && notesMap[id].trim().length > 0;
            }).length;
        },
        renderTree:   renderTree
    };
})();
