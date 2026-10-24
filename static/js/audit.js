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
        initTreatBar();
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

        // Visibly feed a treat to Professor Snoop if correct
        if (isCorrect) {
            feedProfessorSnoopTreat();
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
       Professor Snoop Treat Progress Bar System
       ================================================================ */
    var TOTAL_TREATS = 11;
    var TREAT_STORAGE_KEY = 'snoopanatomy_treats_v1';
    var treatCount = 10;
    var treatTrackEl, treatCountEl, treatSnoopAvatarEl, treatChompBubbleEl;

    function initTreatBar() {
        treatTrackEl       = document.getElementById('treat-track');
        treatCountEl       = document.getElementById('treat-count');
        treatSnoopAvatarEl = document.getElementById('treat-snoop-avatar');
        treatChompBubbleEl = document.getElementById('treat-chomp-bubble');

        // Always initialize treat count at 10 on tab reload
        treatCount = 10;
        localStorage.setItem(TREAT_STORAGE_KEY, '10');

        renderTreatSlots();
    }

    function renderTreatSlots() {
        if (!treatTrackEl) return;
        treatTrackEl.innerHTML = '';

        for (var i = 0; i < TOTAL_TREATS; i++) {
            var slot = document.createElement('div');
            slot.className = 'treat-slot' + (i < treatCount ? ' filled' : '');
            slot.title = 'Bone Treat ' + (i + 1) + ' of ' + TOTAL_TREATS;
            slot.innerHTML = getTreatBoneSvg(16, 10);
            treatTrackEl.appendChild(slot);
        }

        if (treatCountEl) {
            treatCountEl.textContent = String(treatCount);
        }
    }

    function getTreatBoneSvg(w, h) {
        w = w || 16;
        h = h || 10;
        return '<svg class="treat-bone-icon" viewBox="0 0 24 14" width="' + w + '" height="' + h + '">' +
            '<circle cx="4.5" cy="4" r="3.2" fill="currentColor"/>' +
            '<circle cx="4.5" cy="10" r="3.2" fill="currentColor"/>' +
            '<circle cx="19.5" cy="4" r="3.2" fill="currentColor"/>' +
            '<circle cx="19.5" cy="10" r="3.2" fill="currentColor"/>' +
            '<rect x="4" y="4.5" width="16" height="5" rx="1.5" fill="currentColor"/>' +
            '</svg>';
    }

    function feedProfessorSnoopTreat() {
        var willIncrement = treatCount < TOTAL_TREATS;
        if (willIncrement) {
            treatCount++;
            localStorage.setItem(TREAT_STORAGE_KEY, String(treatCount));
        }

        // 1. Source coordinates (from modal submit button or center)
        var sourceX = window.innerWidth / 2;
        var sourceY = window.innerHeight / 2 + 80;
        if (submitBtn) {
            var rect = submitBtn.getBoundingClientRect();
            sourceX = rect.left + rect.width / 2;
            sourceY = rect.top + rect.height / 2;
        }

        // 2. Destination coordinates (Professor Snoop avatar in header)
        var destX = window.innerWidth / 2;
        var destY = 24;
        if (treatSnoopAvatarEl) {
            var destRect = treatSnoopAvatarEl.getBoundingClientRect();
            destX = destRect.left + destRect.width / 2;
            destY = destRect.top + destRect.height / 2;
        }

        // 3. Create flying bone treat
        var flyer = document.createElement('div');
        flyer.className = 'flying-treat-bone';
        flyer.innerHTML = getTreatBoneSvg(24, 15);
        flyer.style.left = (sourceX - 12) + 'px';
        flyer.style.top = (sourceY - 7) + 'px';
        document.body.appendChild(flyer);

        // Animate flying upwards to Professor Snoop
        requestAnimationFrame(function () {
            flyer.style.transform = 'translate(' + (destX - sourceX) + 'px, ' + (destY - sourceY) + 'px) scale(1.2) rotate(360deg)';
        });

        // 4. On arrival at Professor Snoop
        setTimeout(function () {
            if (flyer.parentNode) {
                flyer.parentNode.removeChild(flyer);
            }

            // Update counter and illuminate new slot
            if (treatCountEl) {
                treatCountEl.textContent = String(treatCount);
            }

            if (treatTrackEl) {
                var slots = treatTrackEl.querySelectorAll('.treat-slot');
                if (slots && slots[treatCount - 1]) {
                    slots[treatCount - 1].classList.add('filled', 'just-earned');
                }
            }

            // Professor Snoop munching animation
            if (treatSnoopAvatarEl) {
                treatSnoopAvatarEl.classList.remove('eating');
                void treatSnoopAvatarEl.offsetWidth;
                treatSnoopAvatarEl.classList.add('eating');
            }

            // Happy chomp speech bubble
            if (treatChompBubbleEl) {
                var chompQuotes = ['Yum!', 'Crunch!', 'Delicious!', 'Good boy!', 'Tasty!'];
                var randomQuote = chompQuotes[Math.floor(Math.random() * chompQuotes.length)];
                if (treatCount >= TOTAL_TREATS) {
                    randomQuote = 'All 11 Treats Earned!';
                }
                treatChompBubbleEl.textContent = randomQuote;
                treatChompBubbleEl.classList.remove('visible');
                void treatChompBubbleEl.offsetWidth;
                treatChompBubbleEl.classList.add('visible');

                setTimeout(function () {
                    treatChompBubbleEl.classList.remove('visible');
                }, 1800);
            }

            // Confetti explosion when treats reach 11, then reset counter to 0
            if (treatCount >= TOTAL_TREATS) {
                setTimeout(function () {
                    launchConfettiExplosion();
                }, 200);

                setTimeout(function () {
                    treatCount = 0;
                    localStorage.setItem(TREAT_STORAGE_KEY, '0');
                    renderTreatSlots();
                    if (treatChompBubbleEl) {
                        treatChompBubbleEl.textContent = 'Reset to 0!';
                        treatChompBubbleEl.classList.remove('visible');
                        void treatChompBubbleEl.offsetWidth;
                        treatChompBubbleEl.classList.add('visible');
                        setTimeout(function () {
                            treatChompBubbleEl.classList.remove('visible');
                        }, 1200);
                    }
                }, 2800);
            }
        }, 850);
    }

    /* ================================================================
       Confetti Explosion System
       ================================================================ */
    var confettiAnimationId = null;

    function launchConfettiExplosion() {
        var canvas = document.getElementById('confetti-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'confetti-canvas';
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100vw';
            canvas.style.height = '100vh';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '10000';
            document.body.appendChild(canvas);
        }

        var ctx = canvas.getContext('2d');
        var width = (canvas.width = window.innerWidth);
        var height = (canvas.height = window.innerHeight);

        var colors = ['#f59e0b', '#38bdf8', '#34d399', '#ec4899', '#a855f7', '#fbbf24', '#ffffff', '#f43f5e', '#6366f1'];
        var particles = [];
        var numParticles = 180;
        var originX = width / 2;
        var originY = 48;

        for (var i = 0; i < numParticles; i++) {
            var spreadVx = (Math.random() - 0.5) * 22;
            var spreadVy = Math.random() * 8 + 3;

            particles.push({
                x: originX + (Math.random() - 0.5) * 140,
                y: originY,
                vx: spreadVx,
                vy: spreadVy,
                size: 6 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 12,
                wobble: Math.random() * 10,
                wobbleSpeed: 0.08 + Math.random() * 0.08,
                opacity: 1,
                decay: 0.003 + Math.random() * 0.004,
                shape: Math.random() > 0.3 ? 'rect' : 'circle'
            });
        }

        if (confettiAnimationId) {
            cancelAnimationFrame(confettiAnimationId);
        }

        var startTime = Date.now();

        function render() {
            var elapsed = Date.now() - startTime;
            ctx.clearRect(0, 0, width, height);

            var active = 0;
            for (var p = 0; p < particles.length; p++) {
                var pt = particles[p];
                if (pt.opacity <= 0.01 || pt.y > height + 20) continue;
                active++;

                pt.x += pt.vx;
                pt.y += pt.vy;
                pt.vy += 0.28; // Gravity
                pt.vx *= 0.985; // Air friction
                pt.wobble += pt.wobbleSpeed;
                pt.rotation += pt.rotationSpeed;
                pt.opacity -= pt.decay;

                var currentX = pt.x + Math.sin(pt.wobble) * 2.5;

                ctx.save();
                ctx.translate(currentX, pt.y);
                ctx.rotate((pt.rotation * Math.PI) / 180);
                ctx.globalAlpha = Math.max(0, pt.opacity);
                ctx.fillStyle = pt.color;

                if (pt.shape === 'rect') {
                    ctx.fillRect(-pt.size / 2, -pt.size / 3, pt.size, pt.size * 0.65);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, pt.size * 0.45, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            if (active > 0 && elapsed < 4500) {
                confettiAnimationId = requestAnimationFrame(render);
            } else {
                ctx.clearRect(0, 0, width, height);
                confettiAnimationId = null;
            }
        }

        render();
    }

    function resetTreats() {
        treatCount = 0;
        localStorage.setItem(TREAT_STORAGE_KEY, '0');
        renderTreatSlots();
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
        logToChat:            logToChat,
        feedTreat:            feedProfessorSnoopTreat,
        launchConfetti:       launchConfettiExplosion,
        resetTreats:          resetTreats
    };
})();
