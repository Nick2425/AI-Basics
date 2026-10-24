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
        if (sender === 'user') {
            avatarEl.textContent = 'You';
        } else {
            avatarEl.innerHTML = '<img src="/images/professor_snoop_avatar.png" alt="Professor Snoop" class="chat-avatar-icon"> Professor Snoop';
        }
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

        if (window.NeuroTerminal) {
            window.NeuroTerminal.execute(rawText, function (contentHtml, extraClass) {
                logToChat('tutor', contentHtml, extraClass);
            });
        }
    }

    /* ================================================================
       Audit Execution Loop
       ================================================================ */
    function triggerAudit() {
        hideProactiveBanner();
        logToChat('tutor', 'Initiating cranial-cervical knowledge-gap audit...');

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
            logToChat('tutor', 'Could not complete audit: ' + escapeHtml(err.message));
        });
    }

    function handleAuditResult(data) {
        if (!data || data.status !== 'gap_detected') {
            logToChat('tutor', 'Audit complete: Comprehensive anatomical coverage verified across all 11 active structures.', 'feedback-correct');
            return;
        }

        currentGapData = data;
        var targetId = data.target_structure_id;
        var targetName = data.structure_name;
        var cameraCoords = data.camera_target;

        var messageHtml =
            '<span class="gap-title">Detected Knowledge Gap: ' + escapeHtml(targetName) + '</span>' +
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

        // Initialize Snoopy Mascot in Pointing/Inquisitive State
        var snoopyImg = document.getElementById('snoopy-mascot-img');
        var snoopyGuide = document.getElementById('snoopy-audit-guide');
        var snoopySpeech = document.getElementById('snoopy-speech');
        if (snoopyImg) snoopyImg.src = '/images/snoopy_pointing.png';
        if (snoopyGuide) snoopyGuide.className = 'snoopy-audit-guide state-asking';
        if (snoopySpeech) snoopySpeech.innerHTML = 'Examine this anatomical blind spot! What functional deficit occurs?';

        if (feedbackEl) {
            feedbackEl.style.display = 'none';
            feedbackEl.textContent   = '';
        }

        if (submitBtn) {
            submitBtn.textContent = 'Submit Clinical Assessment';
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
            submitBtn.textContent = 'Evaluating Assessment...';
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
                submitBtn.textContent = 'Submit Clinical Assessment';
                submitBtn.disabled = false;
            }
        });
    }

    function handleWhatIfResponse(resData) {
        var isCorrect = resData.is_correct;
        var feedbackText = resData.clinical_feedback;
        var structureId = resData.structure_id || (currentGapData ? currentGapData.target_structure_id : '');

        if (feedbackEl) {
            feedbackEl.className = 'whatif-feedback ' + (isCorrect ? 'feedback-correct' : 'feedback-partial');
            feedbackEl.textContent = feedbackText + ' Takeaway and companion feedback saved to audit_notes folder.';
            feedbackEl.style.display = 'block';
        }

        // Transition Snoopy Mascot to Celebratory/Proud State
        var snoopyImg = document.getElementById('snoopy-mascot-img');
        var snoopyGuide = document.getElementById('snoopy-audit-guide');
        var snoopySpeech = document.getElementById('snoopy-speech');
        if (snoopyImg) snoopyImg.src = '/images/snoopy_happy.png';
        if (snoopyGuide) snoopyGuide.className = 'snoopy-audit-guide state-answered';
        if (snoopySpeech) {
            snoopySpeech.innerHTML = isCorrect
                ? '<strong>Brilliant clinical reasoning!</strong> Diagnostic assessment verified.'
                : '<strong>Good clinical analysis!</strong> Takeaway recorded in your audit notes.';
        }

        // 1. Save full audit record to separate folder in NeuroNotes
        if (window.NeuroNotes && resData.audit_record) {
            NeuroNotes.saveAuditRecord(resData.audit_record);
        }

        // 2. Append clinical takeaway to the structure's regular study note in NeuroNotes
        if (window.NeuroNotes && structureId) {
            var currentNotes = NeuroNotes.getNotes();
            var existingNote = currentNotes[structureId] || '';
            var updated = existingNote
                ? (existingNote + resData.append_text)
                : ('Clinical Study Note: ' + resData.key_takeaway);

            NeuroNotes.saveNote(structureId, updated);
        }

        // 3. Companion confirmation in conversational chat stream
        var chatHtml =
            (isCorrect ? '<strong>Assessment confirmed.</strong> ' : '<strong>Clinical correlation:</strong> ') +
            escapeHtml(feedbackText) +
            '<br><br><em>Full companion feedback and takeaway saved to the <strong>Clinical Audit Notes</strong> folder (audit_notes/' + escapeHtml(structureId) + '_audit.md).</em>';

        // Quick action button to inspect the audit note
        var actions = [
            {
                label: 'View Audit Note',
                className: 'btn-secondary btn-xs',
                onClick: function () {
                    if (window.NeuroNotes) {
                        NeuroNotes.openAuditRecordById(structureId);
                    }
                }
            }
        ];

        logToChat('tutor', chatHtml, isCorrect ? 'feedback-correct' : 'feedback-partial', actions);

        if (submitBtn) {
            submitBtn.textContent = 'Takeaway & Audit Saved';
        }

        // Auto-close modal after review with Snoopy celebration and recenter camera
        setTimeout(function () {
            closeModal();
        }, 2500);
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
