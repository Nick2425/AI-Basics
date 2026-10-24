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
           Initialize the 3D viewport
           ============================================================== */
        var viewportContainer = document.getElementById('viewport-container');
        if (viewportContainer && window.NeuroViewport) {
            NeuroViewport.init(viewportContainer);
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
    });
})();
