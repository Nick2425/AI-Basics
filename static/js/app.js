/**
 * NeuroSoma - Main Application Coordinator
 *
 * Initializes the 3D viewport and wires up the menu bar.
 * Additional modules (notes, terminal, themes) are registered here
 * as they are added in later slices.
 *
 * Depends on: NeuroViewport (viewport.js)
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {

        /* ==============================================================
           Initialize the 3D viewport & synchronized ViewCube
           ============================================================== */
        var viewportContainer = document.getElementById('viewport-container');
        var viewCubeContainer = document.getElementById('viewcube-container');
        if (viewportContainer && window.NeuroViewport) {
            NeuroViewport.init(viewportContainer, viewCubeContainer);
        }

        /* ==============================================================
           Initialize Study Notes & Left Tree
           ============================================================== */
        if (window.NeuroNotes) {
            NeuroNotes.init();
        }

        /* ==============================================================
           Initialize Clinical Audit Engine & Terminal
           ============================================================== */
        if (window.NeuroAudit) {
            NeuroAudit.init();
        }

        /* ==============================================================
           Layer visibility toggles (View > Layers)
           ============================================================== */
        var layerNervous = document.getElementById('layer-nervous');
        if (layerNervous) {
            layerNervous.addEventListener('change', function () {
                if (window.NeuroViewport) {
                    NeuroViewport.setLayerVisible('nervous', this.checked);
                }
            });
        }

        var layerMusculo = document.getElementById('layer-musculoskeletal');
        if (layerMusculo) {
            layerMusculo.addEventListener('change', function () {
                if (window.NeuroViewport) {
                    NeuroViewport.setLayerVisible('musculoskeletal', this.checked);
                }
            });
        }

        /* ==============================================================
           Menu bar dropdown behavior
           ============================================================== */
        var menuItems = document.querySelectorAll('.menu-item');

        menuItems.forEach(function (item) {
            var btn = item.querySelector('.menu-button');
            if (!btn) return;

            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                // Close sibling dropdowns
                menuItems.forEach(function (other) {
                    if (other !== item) other.classList.remove('open');
                });
                var isOpen = item.classList.toggle('open');
                btn.setAttribute('aria-expanded', isOpen);
            });
        });

        // Close all dropdowns on outside click
        document.addEventListener('click', function () {
            menuItems.forEach(function (item) {
                item.classList.remove('open');
                var btn = item.querySelector('.menu-button');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            });
        });

        // Prevent dropdown clicks from closing the dropdown
        document.querySelectorAll('.dropdown').forEach(function (dd) {
            dd.addEventListener('click', function (e) {
                e.stopPropagation();
            });
        });

        /* ==============================================================
           Theme Switcher (Surgical Dark, Clean Light, Off-Pink)
           ============================================================== */
        var THEME_STORAGE_KEY = 'neurosoma_theme';
        var themeBtns = document.querySelectorAll('.theme-btn');

        function setTheme(themeId) {
            var validThemes = ['dark', 'light', 'pink'];
            if (!validThemes.includes(themeId)) themeId = 'dark';

            // 1. Update HTML data-theme attribute
            document.documentElement.setAttribute('data-theme', themeId);

            // 2. Update active button in header
            themeBtns.forEach(function (btn) {
                if (btn.getAttribute('data-theme') === themeId) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // 3. Update 3D canvas and fog via NeuroViewport
            if (window.NeuroViewport) {
                NeuroViewport.setTheme(themeId);
            }

            // 4. Save to localStorage
            try {
                localStorage.setItem(THEME_STORAGE_KEY, themeId);
            } catch (e) {
                console.error(e);
            }
        }

        themeBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tid = this.getAttribute('data-theme');
                if (tid) setTheme(tid);
            });
        });

        // Restore saved theme on startup
        try {
            var savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme) {
                setTheme(savedTheme);
            }
        } catch (e) {}

        window.NeuroTheme = {
            setTheme: setTheme,
            getTheme: function () {
                return document.documentElement.getAttribute('data-theme') || 'dark';
            }
        };
    });
})();
