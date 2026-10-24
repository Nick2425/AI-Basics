/**
 * NeuroSoma - Terminal & Command Parser Engine
 *
 * Implements command processing for clinical study console:
 * - audit: initiates active knowledge gap evaluation
 * - inspect <name>: isolates structure with 25% transparency dimming
 * - layer <nervous|musculoskeletal> [on|off]: toggles anatomical systems and syncs menu checkboxes
 * - theme <dark|light|pink>: switches CSS palette and Three.js scene
 * - view <front|back|left|right|top|bottom>: snaps camera orthogonally
 * - recenter: resets camera to default overview perspective
 * - clear: clears console/chat log
 * - help: lists all available commands with clinical syntax
 *
 * Exposes: window.NeuroTerminal
 */
(function () {
    'use strict';

    function execute(rawText, logFn) {
        if (!rawText || typeof rawText !== 'string') return;
        var clean = rawText.trim();
        if (!clean) return;

        var parts = clean.split(/\s+/);
        var cmd = parts[0].toLowerCase();
        var arg = parts.slice(1).join(' ');

        var log = logFn || (window.NeuroAudit && window.NeuroAudit.logToChat
            ? function (msg, cls) { window.NeuroAudit.logToChat('tutor', msg, cls); }
            : console.log);

        switch (cmd) {
            case 'audit':
                if (window.NeuroAudit) {
                    window.NeuroAudit.triggerAudit();
                } else {
                    log('Audit engine initializing...');
                }
                break;

            case 'recenter':
            case 'reset':
                if (window.NeuroViewport) {
                    window.NeuroViewport.resetCamera(650);
                    log('Camera recentered to anatomical overview.');
                }
                break;

            case 'theme':
                handleThemeCommand(arg, log);
                break;

            case 'layer':
                handleLayerCommand(arg, log);
                break;

            case 'inspect':
                handleInspectCommand(arg, log);
                break;

            case 'view':
                handleViewCommand(arg, log);
                break;

            case 'clear':
                var logContainer = document.getElementById('terminal-log');
                if (logContainer) {
                    logContainer.innerHTML = '';
                    log('Console cleared. Enter commands or query structures.');
                }
                break;

            case 'help':
                printHelp(log);
                break;

            default:
                // If it looks like a structure query, try to inspect it
                if (!handleInspectFuzzy(clean, log)) {
                    log('Unrecognized command: <code>' + escapeHtml(cmd) + '</code>. Type <code>help</code> for clinical command syntax.');
                }
                break;
        }
    }

    function handleThemeCommand(arg, log) {
        var themeId = arg.toLowerCase().trim();
        var valid = ['dark', 'light', 'pink'];
        if (!valid.includes(themeId)) {
            log('Unknown theme: "' + escapeHtml(arg) + '". Supported options: <code>dark</code> (Surgical Dark), <code>light</code> (Clean Light), <code>pink</code> (Off-Pink).');
            return;
        }

        if (window.NeuroTheme) {
            window.NeuroTheme.setTheme(themeId);
            var names = { dark: 'Surgical Dark', light: 'Clean Light', pink: 'Off-Pink' };
            log('Theme switched to <strong>' + names[themeId] + '</strong>.');
        } else {
            document.documentElement.setAttribute('data-theme', themeId);
            if (window.NeuroViewport) window.NeuroViewport.setTheme(themeId);
            log('Theme applied: ' + themeId);
        }
    }

    function handleLayerCommand(arg, log) {
        if (!arg) {
            log('Usage: <code>layer &lt;nervous|musculo&gt; [on|off]</code>');
            return;
        }

        var parts = arg.toLowerCase().trim().split(/\s+/);
        var targetSystem = parts[0];
        var action = parts[1]; // optional: on, off, toggle

        var systemKey = null;
        var checkboxId = null;
        var displayName = null;

        if (targetSystem === 'nervous' || targetSystem === 'nerve' || targetSystem === 'nerves') {
            systemKey = 'nervous';
            checkboxId = 'layer-nervous';
            displayName = 'Nervous System';
        } else if (targetSystem === 'musculo' || targetSystem === 'musculoskeletal' || targetSystem === 'muscle' || targetSystem === 'bone') {
            systemKey = 'musculoskeletal';
            checkboxId = 'layer-musculoskeletal';
            displayName = 'Musculoskeletal System';
        } else {
            log('Unknown layer "' + escapeHtml(targetSystem) + '". Supported: <code>nervous</code>, <code>musculoskeletal</code>.');
            return;
        }

        var checkbox = document.getElementById(checkboxId);
        var currentVisible = checkbox ? checkbox.checked : true;
        var nextVisible = currentVisible;

        if (action === 'on' || action === 'show' || action === 'enable' || action === '1') {
            nextVisible = true;
        } else if (action === 'off' || action === 'hide' || action === 'disable' || action === '0') {
            nextVisible = false;
        } else {
            // Toggle
            nextVisible = !currentVisible;
        }

        if (checkbox) checkbox.checked = nextVisible;
        if (window.NeuroViewport) {
            window.NeuroViewport.setLayerVisible(systemKey, nextVisible);
        }

        log(displayName + ' set to <strong>' + (nextVisible ? 'visible' : 'hidden') + '</strong>.');
    }

    function handleInspectCommand(query, log) {
        if (!query) {
            log('Usage: <code>inspect &lt;structure name&gt;</code> (e.g., <em>inspect vagus</em>, <em>inspect atlas</em>)');
            return;
        }

        if (!window.NeuroViewport) return;
        var structures = window.NeuroViewport.getAnatomyData() || [];
        var cleanQ = query.toLowerCase().trim();
        var match = null;

        for (var i = 0; i < structures.length; i++) {
            var s = structures[i];
            if (s.id.toLowerCase().includes(cleanQ) || s.name.toLowerCase().includes(cleanQ)) {
                match = s;
                break;
            }
        }

        if (match) {
            window.NeuroViewport.selectStructureById(match.id);
            log('Isolated <strong>' + escapeHtml(match.name) + '</strong> in 3D.<br>' + escapeHtml(match.clinical_relevance || match.description));
        } else {
            log('No anatomical structure matched "' + escapeHtml(query) + '". Type a name such as <em>vagus</em>, <em>accessory</em>, <em>phrenic</em>, <em>scm</em>, <em>scalene</em>, <em>atlas</em>, or <em>axis</em>.');
        }
    }

    function handleInspectFuzzy(text, log) {
        if (!window.NeuroViewport) return false;
        var structures = window.NeuroViewport.getAnatomyData() || [];
        var q = text.toLowerCase();
        var match = null;

        for (var i = 0; i < structures.length; i++) {
            var s = structures[i];
            var idWords = s.id.replace(/_/g, ' ');
            if (q.includes(idWords) || q.includes(s.name.toLowerCase()) || (s.id.length > 3 && q.includes(s.id))) {
                match = s;
                break;
            }
        }

        if (match) {
            window.NeuroViewport.selectStructureById(match.id);
            log('Focused on <strong>' + escapeHtml(match.name) + '</strong> in 3D.<br>' + escapeHtml(match.clinical_relevance || match.innervation || match.description));
            return true;
        }
        return false;
    }

    function handleViewCommand(face, log) {
        if (!face) {
            log('Usage: <code>view &lt;front|back|left|right|top|bottom&gt;</code>');
            return;
        }
        var valid = ['front', 'back', 'left', 'right', 'top', 'bottom'];
        var cleanFace = face.toLowerCase().trim();
        if (!valid.includes(cleanFace)) {
            log('Invalid view face: "' + escapeHtml(face) + '". Options: <code>front</code>, <code>back</code>, <code>left</code>, <code>right</code>, <code>top</code>, <code>bottom</code>.');
            return;
        }

        if (window.NeuroViewport) {
            window.NeuroViewport.snapCameraTo(cleanFace);
            log('Oriented camera to <strong>' + cleanFace.toUpperCase() + '</strong> orthogonal projection.');
        }
    }

    function printHelp(log) {
        log(
            'Available clinical commands:<br>' +
            '• <code>audit</code> - Initiate knowledge-gap audit across your study notes<br>' +
            '• <code>theme &lt;dark|light|pink&gt;</code> - Switch clinical visual theme<br>' +
            '• <code>layer &lt;nervous|musculo&gt; [on|off]</code> - Toggle anatomical systems<br>' +
            '• <code>inspect &lt;name&gt;</code> - Zoom to and isolate structure in 3D<br>' +
            '• <code>view &lt;front|back|left|right|top|bottom&gt;</code> - Snap camera orthogonally<br>' +
            '• <code>recenter</code> - Reset camera to overview perspective (shortcut: R)<br>' +
            '• <code>clear</code> - Clear console output log'
        );
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
    window.NeuroTerminal = {
        execute: execute,
        handleInspect: handleInspectCommand,
        handleTheme: handleThemeCommand,
        handleLayer: handleLayerCommand
    };
})();
