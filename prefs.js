/* SPDX-License-Identifier: GPL-2.0-or-later */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SimpleScalePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();

        /* ----- Animation Physics ----- */
        const groupPhysics = new Adw.PreferencesGroup({
            title: 'Animation Physics',
            description: 'Configure how the window moves.'
        });
        page.add(groupPhysics);

        const curveRow = new Adw.ComboRow({
            title: 'Movement Style',
            subtitle: 'Applied only if Bounce Scale is 1.00.',
            model: new Gtk.StringList({
                strings: [
                    'Suction (Accelerate In)',
                    'Glide (Decelerate Out)',
                    'Linear (Constant Speed)'
                ]
            })
        });
        settings.bind('animation-curve', curveRow, 'selected', 0);
        groupPhysics.add(curveRow);

        const durationRow = new Adw.SpinRow({
            title: 'Duration (ms)',
            subtitle: 'Length of the animation.',
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 2000,
                step_increment: 50
            })
        });
        settings.bind('duration', durationRow, 'value', 0);
        groupPhysics.add(durationRow);

        /* ----- Bounce Effect ----- */
        const groupAdv = new Adw.PreferencesGroup({
            title: 'Bounce Effect',
            description: 'Settings for the "jump" effect.'
        });
        page.add(groupAdv);

        const scaleRow = new Adw.SpinRow({
            title: 'Bounce Scale',
            subtitle: '1.00 = No bounce. > 1.00 = Bounce enabled.',
            digits: 2,
            adjustment: new Gtk.Adjustment({
                lower: 1.00,
                upper: 1.50,
                step_increment: 0.01
            })
        });
        settings.bind('bounce-scale', scaleRow, 'value', 0);
        groupAdv.add(scaleRow);

        const opacityRow = new Adw.SpinRow({
            title: 'Drop Opacity',
            subtitle: 'Opacity while dropping (0-255).',
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 255,
                step_increment: 5
            })
        });
        settings.bind('final-opacity', opacityRow, 'value', 0);
        groupAdv.add(opacityRow);

        /* ----- Restore Defaults ----- */
        const groupReset = new Adw.PreferencesGroup();
        page.add(groupReset);

        const resetButton = new Gtk.Button({
            label: 'Reset to Defaults',
            css_classes: ['destructive-action']
        });

        resetButton.connect('clicked', () => {
            settings.reset('duration');
            settings.reset('final-opacity');
            settings.reset('bounce-scale');
            settings.reset('bounce-ratio');
            settings.reset('animation-curve');
        });
        groupReset.add(resetButton);

        window.add(page);
    }
}

