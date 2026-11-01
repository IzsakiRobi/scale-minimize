<p align="center">
  <img src="Screenshots/scale-minimize-icon.svg" alt="DashCraft" width="256" height="256">
</p>

# Simple Scale Minimize

A lightweight minimize and restore animation toward the bottom of the screen, with configurable timing, movement curve, bounce, and opacity.

Version **1.1** · GNOME Shell **45–51** · UUID: `scale-minimize@ostricks.com`

Download the extension ZIP from [Releases](https://github.com/IzsakiRobi/scale-minimize/releases/latest) and install it with:

```sh
gnome-extensions install --force scale-minimize@ostricks.com.shell-extension.zip
```

For a source checkout, compile settings with `glib-compile-schemas schemas` after copying the runtime files into the extension directory. Restart your session if GNOME Shell has not discovered the extension yet.

## GNOME review note

GNOME 51 is a stable release according to the [official release calendar](https://release.gnome.org/calendar/). Shexli 0.2.1 still hard-codes versions greater than 50 as future releases, so its `EGO-M-004` finding for `51` is a false positive. The metadata retains GNOME 51 support rather than hiding it from users.

Licensed under GPL-2.0-or-later; see [LICENSE](LICENSE).
