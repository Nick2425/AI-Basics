/**
 * NeuroSoma - Knowledge-Gap Audit & Conversational Tutor Controller
 *
 * Implements:
 * - Conversational chat interface in the right panel with tutor avatars and chat bubbles
 * - Proactive and manual audit prompt triggers
 * - POST /api/audit integration to identify unaddressed structures
 * - Camera glide and transparency isolation of detected gaps
 * - Clinical "What-If" scenario modal overlay with student-friendly wording
 * - Camera recentering back to overview after audit completion or modal dismiss
 * - POST /api/what-if evaluation with warm, friendly chat confirmations
 * - Conversational command execution (audit, recenter, inspect, view, help)
 *
 * Depends on: NeuroViewport (viewport.js), NeuroNotes (notes.js)
 * Exposes:    window.NeuroAudit
 */
(function () {
    'use strict';

    // State
    var currentGapData = null;

    // DOM Elements
    var terminalLogEl, terminalInputEl, auditBtnEl, chatSendBtnEl, chatInputFormEl, recenterCamBtnEl;
    var proactiveBannerEl, btnAcceptAudit, btnDeclineAudit;
    var modalEl, modalTitleEl, gapDescEl, questionEl, answerEl, feedbackEl, closeBtn, dismissBtn, submitBtn;

    /* ================================================================
       Initialization
       ================================================================ */
    function init() {
        terminalLogEl      = document.getElementById('terminal-log');
        terminalInputEl    = document.getElementById('terminal-input');
        chatSendBtnEl      = document.getElementById('chat-send-btn');
        chatInputFormEl    = document.getElementById('chat-input-form');
        auditBtnEl         = document.getElementById('terminal-audit-btn');
        recenterCamBtnEl   = document.getElementById('recenter-cam-btn');
        proactiveBannerEl  = document.getElementById('audit-proactive-banner');
        btnAcceptAudit     = document.getElementById('btn-accept-audit');
        btnDeclineAudit    = document.getElementById('btn-decline-audit');

        modalEl            = document.getElementById('whatif-modal');
        modalTitleEl       = document.getElementById('whatif-title');
        gapDescEl          = document.getElementById('whatif-gap-desc');
        questionEl         = document.getElementById('whatif-question');
        answerEl           = document.getElementById('whatif-answer');
        feedbackEl         = document.getElementById('whatif-feedback');
        closeBtn           = document.getElementById('whatif-close-btn');
        dismissBtn         = document.getElementById('whatif-dismiss-btn');
        submitBtn          = document.getElementById('whatif-submit-btn');

        setupEventListeners();
    }

    /* ================================================================
       Event Listeners
       ================================================================ */
    function setupEventListeners() {
        if (auditBtnEl) {
            auditBtnEl.addEventListener('click', function () {
                triggerAudit();
            });
        }

        if (recenterCamBtnEl) {
            recenterCamBtnEl.addEventListener('click', function () {
                if (window.NeuroViewport) {
                    NeuroViewport.resetCamera(650);
                    logToChat('tutor', 'Camera recentered to overview.');
                }
            });
        }

        if (btnAcceptAudit) {
            btnAcceptAudit.addEventListener('click', function () {
                hideProactiveBanner();
                triggerAudit();
            });
        }

        if (btnDeclineAudit) {
            btnDeclineAudit.addEventListener('click', function () {
                hideProactiveBanner();
                logToChat('tutor', 'No problem! Whenever you are ready, click <strong>Audit Notes</strong> or type <strong>audit</strong>.');
            });
        }

        if (chatInputFormEl) {
            chatInputFormEl.addEventListener('submit', function (e) {
                e.preventDefault();
                submitUserMessage();
            });
        }

        if (terminalInputEl) {
            terminalInputEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitUserMessage();
                }
            });
        }

        if (chatSendBtnEl) {
            chatSendBtnEl.addEventListener('click', function (e) {
                e.preventDefault();
                submitUserMessage();
            });
        }

        // Modal event listeners
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (dismissBtn) dismissBtn.addEventListener('click', closeModal);

        if (submitBtn) {
            submitBtn.addEventListener('click', function () {
                submitWhatIfAssessment();
            });
        }

        if (modalEl) {
            modalEl.addEventListener('click', function (e) {
                if (e.target === modalEl) closeModal();
            });
        }
    }

    function submitUserMessage() {
        if (!terminalInputEl) return;
        var text = terminalInputEl.value.trim();
        if (!text) return;
        terminalInputEl.value = '';
        handleUserMessage(text);
    }

    /* ================================================================
       Proactive Banner
       ================================================================ */
    function showProactivePrompt() {
        if (proactiveBannerEl) {
            proactiveBannerEl.style.display = 'flex';
        }
    }

    function hideProactiveBanner() {
        if (proactiveBannerEl) {
            proactiveBannerEl.style.display = 'none';
        }
    }

    /* ================================================================
       Conversational Chat Logging
       ================================================================ */
    function logToChat(sender, contentHtml, extraClass, actions) {
        if (!terminalLogEl) return;

        var msgEl = document.createElement('div');
        msgEl.className = 'chat-msg ' + (sender === 'user' ? 'user' : 'tutor');

        var avatarEl = document.createElement('div');
        avatarEl.className = 'chat-avatar';
        avatarEl.textContent = (sender === 'user' ? 'You' : 'Tutor');
        msgEl.appendChild(avatarEl);

        var bubbleEl = document.createElement('div');
        bubbleEl.className = 'chat-bubble' + (extraClass ? (' ' + extraClass) : '');
        bubbleEl.innerHTML = contentHtml;

        if (actions && actions.length > 0) {
            var actionsContainer = document.createElement('div');
            actionsContainer.className = 'chat-bubble-actions';
            actions.forEach(function (act) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = act.className || 'btn-primary btn-xs';
                btn.textContent = act.label;
                btn.addEventListener('click', act.onClick);
                actionsContainer.appendChild(btn);
            });
            bubbleEl.appendChild(actionsContainer);
        }

        msgEl.appendChild(bubbleEl);
        terminalLogEl.appendChild(msgEl);
        terminalLogEl.scrollTop = terminalLogEl.scrollHeight;
    }

    // Backward-compatible logToTerminal alias
    function logToTerminal(message, type) {
        var extra = '';
        if (type === 'gap') extra = 'gap-card';
        else if (type === 'success') extra = 'feedback-correct';
        logToChat('tutor', escapeHtml(message), extra);
    }

    /* ================================================================
       User Message & Command Handling
       ================================================================ */
    function handleUserMessage(rawText) {
        logToChat('user', escapeHtml(rawText));

        var clean = rawText.toLowerCase().trim();
        var parts = clean.split(/\s+/);
        var cmd = parts[0];
        var arg = parts.slice(1).join(' ');

        if (cmd === 'audit' || clean.includes('audit') || clean.includes('check notes') || clean.includes('quiz')) {
            triggerAudit();
        } else if (cmd === 'recenter' || cmd === 'reset' || clean.includes('recenter') || clean.includes('reset view')) {
            if (window.NeuroViewport) {
                NeuroViewport.resetCamera(650);
                logToChat('tutor', 'Camera recentered to overview.');
            }
        } else if (cmd === 'clear') {
            if (terminalLogEl) {
                terminalLogEl.innerHTML = '';
                logToChat('tutor', 'Chat cleared. How can I help you study?');
            }
        } else if (cmd === 'help') {
            logToChat('tutor',
                'Here are some helpful things you can do:<br>' +
                '• Click <strong>Audit Notes</strong> or type <strong>audit</strong> to test for blind spots.<br>' +
                '• Type <strong>recenter</strong> to reset your 3D view.<br>' +
                '• Type <strong>inspect &lt;name&gt;</strong> (e.g., <em>inspect vagus</em>) to focus on a structure.<br>' +
                '• Use your <strong>arrow keys</strong> in the 3D viewport to orbit around structures smoothly.'
            );
        } else if (cmd === 'inspect' && arg) {
            inspectByName(arg);
        } else if (cmd === 'view' && arg) {
            if (window.NeuroViewport) {
                NeuroViewport.snapCameraTo(arg);
                logToChat('tutor', 'Orienting camera to ' + escapeHtml(arg) + ' view.');
            }
        } else {
            // General conversational lookup
            handleConversationalQuery(rawText);
        }
    }

    function handleConversationalQuery(query) {
        if (!window.NeuroViewport) {
            logToChat('tutor', 'I am here to help you study anatomy! Click <strong>Audit Notes</strong> or type a structure name to inspect.');
            return;
        }

        var structures = NeuroViewport.getAnatomyData() || [];
        var q = query.toLowerCase();
        var match = null;

        for (var i = 0; i < structures.length; i++) {
            var s = structures[i];
            if (q.includes(s.id.replace(/_/g, ' ')) || q.includes(s.name.toLowerCase()) || s.id.toLowerCase().includes(q)) {
                match = s;
                break;
            }
        }

        if (match) {
            NeuroViewport.selectStructureById(match.id);
            var info = match.clinical_relevance || match.innervation || match.description;
            logToChat('tutor',
                'Focused on <strong>' + escapeHtml(match.name) + '</strong> in 3D.<br>' +
                escapeHtml(info)
            );
        } else {
            logToChat('tutor',
                'I can help you review the cranial nerves, cervical muscles, and spine! Type <strong>audit</strong> to run a knowledge check, or ask about any structure.'
            );
        }
    }

    function inspectByName(query) {
        if (!window.NeuroViewport) return;
        var structures = NeuroViewport.getAnatomyData() || [];
        var match = null;
        for (var i = 0; i < structures.length; i++) {
            var s = structures[i];
            if (s.id.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)) {
                match = s;
                break;
            }
        }
        if (match) {
            NeuroViewport.selectStructureById(match.id);
            logToChat('tutor', 'Highlighting <strong>' + escapeHtml(match.name) + '</strong> in 3D.');
        } else {
            logToChat('tutor', 'Could not find a structure matching "' + escapeHtml(query) + '". Try searching for "vagus", "phrenic", "atlas", or "trapezius".');
        }
    }

    /* ================================================================
       Audit Execution Loop
       ================================================================ */
    function triggerAudit() {
        hideProactiveBanner();
        logToChat('tutor', 'Checking your notes against our anatomy knowledge graph...');

        var notes = window.NeuroNotes ? NeuroNotes.getNotes() : {};

        fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: notes })
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            handleAuditResult(data);
        })
        .catch(function (err) {
            console.error('[NeuroAudit] Audit error:', err);
            logToChat('tutor', 'Could not complete audit right now: ' + escapeHtml(err.message));
        });
    }

    function handleAuditResult(data) {
        if (!data || data.status !== 'gap_detected') {
            logToChat('tutor', 'Outstanding work! You have solid notes covering all 11 cranial and cervical structures.', 'feedback-correct');
            return;
        }

        currentGapData = data;
        var targetId = data.target_structure_id;
        var targetName = data.structure_name;
        var cameraCoords = data.camera_target;

        var messageHtml =
            '<span class="gap-title">Knowledge Check: ' + escapeHtml(targetName) + '</span>' +
            escapeHtml(data.gap_explanation);

        logToChat('tutor', messageHtml, 'gap-card');

        // 1. Camera smoothly glides to gap coordinates
        if (window.NeuroViewport && cameraCoords) {
            NeuroViewport.glideToTarget(cameraCoords, 750);
        }

        // 2. Isolate gap structure with transparency dimming
        setTimeout(function () {
            if (window.NeuroViewport) {
                NeuroViewport.selectStructureById(targetId);
            }

            // 3. Open Clinical "What-If" Modal
            openWhatIfModal(data);
        }, 450);
    }

    /* ================================================================
       "What-If" Clinical Modal
       ================================================================ */
    function openWhatIfModal(data) {
        if (!modalEl) return;

        modalTitleEl.textContent = data.structure_name;
        gapDescEl.textContent    = data.gap_explanation;
        questionEl.textContent   = data.what_if_prompt;
        answerEl.value           = '';

        if (feedbackEl) {
            feedbackEl.style.display = 'none';
            feedbackEl.textContent   = '';
        }

        if (submitBtn) {
            submitBtn.textContent = 'Check Answer';
            submitBtn.disabled    = false;
        }

        modalEl.style.display = 'flex';
        answerEl.focus();
    }

    function closeModal() {
        if (modalEl) modalEl.style.display = 'none';
        currentGapData = null;

        // Recenter camera smoothly back to overview after closing the scenario
        if (window.NeuroViewport) {
            NeuroViewport.resetCamera(650);
        }
    }

    function submitWhatIfAssessment() {
        if (!currentGapData || !answerEl) return;
        var answerText = answerEl.value.trim();

        if (answerText.length === 0) {
            answerEl.focus();
            return;
        }

        if (submitBtn) {
            submitBtn.textContent = 'Checking...';
            submitBtn.disabled = true;
        }

        fetch('/api/what-if', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structure_id: currentGapData.target_structure_id,
                question:     currentGapData.what_if_prompt,
                answer:       answerText
            })
        })
        .then(function (res) { return res.json(); })
        .then(function (resData) {
            handleWhatIfResponse(resData);
        })
        .catch(function (err) {
            console.error('[NeuroAudit] What-if error:', err);
            if (submitBtn) {
                submitBtn.textContent = 'Check Answer';
                submitBtn.disabled = false;
            }
        });
    }

    function handleWhatIfResponse(resData) {
        var isCorrect = resData.is_correct;
        var feedbackText = resData.clinical_feedback;

        if (feedbackEl) {
            feedbackEl.className = 'whatif-feedback ' + (isCorrect ? 'feedback-correct' : 'feedback-partial');
            feedbackEl.textContent = feedbackText + ' Saved to your study notes!';
            feedbackEl.style.display = 'block';
        }

        // Friendly confirmation in the conversational chat stream
        var chatHtml =
            (isCorrect ? '<strong>Spot on!</strong> ' : '<strong>Good try!</strong> ') +
            escapeHtml(feedbackText) +
            '<br><br><em>Saved key takeaway to your study notes for ' + escapeHtml(resData.structure_name) + '.</em>';

        logToChat('tutor', chatHtml, isCorrect ? 'feedback-correct' : 'feedback-partial');

        // Append clinical takeaway to the structure's note in NeuroNotes
        if (window.NeuroNotes && currentGapData) {
            var targetId = currentGapData.target_structure_id;
            var currentNotes = NeuroNotes.getNotes();
            var existingNote = currentNotes[targetId] || '';
            var updated = existingNote
                ? (existingNote + resData.append_text)
                : ('Clinical Study Note: ' + resData.key_takeaway);

            NeuroNotes.saveNote(targetId, updated);
        }

        if (submitBtn) {
            submitBtn.textContent = 'Takeaway Saved';
        }

        // Auto-close modal after brief review and recenter camera
        setTimeout(function () {
            closeModal();
        }, 1800);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* ================================================================
       Public API
       ================================================================ */
    window.NeuroAudit = {
        init:                 init,
        triggerAudit:         triggerAudit,
        showProactivePrompt:  showProactivePrompt,
        hideProactivePrompt:  hideProactiveBanner,
        logToTerminal:        logToTerminal,
        logToChat:            logToChat
    };
})();
