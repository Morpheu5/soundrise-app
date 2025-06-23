# NOTICE

This file lists the third‑party components, fonts, icons, and other material included in SoundRise 2.0, along with their respective copyright notices and license terms, as required by the licenses of those components.

---

## PROJECT‑LEVEL LICENSE

SoundRise 2.0 is licensed under the GNU Affero General Public License, version 3 (or any later version).  See the LICENSE file in the same directory for the full text.

---

## THIRD‑PARTY SOFTWARE COMPONENTS

Each entry shows: **Package** — **Version range used** — **Upstream license**  — **Copyright notice** (truncated where © symbol appears).

| Package                            | Version        | License                                         | Copyright / Notes                                |
| ---------------------------------- | -------------- | ----------------------------------------------- | ------------------------------------------------ |
| react                              | ^18 ("latest") | MIT                                             | © Facebook, Inc. and contributors                |
| react‑dom                          | ^18 ("latest") | MIT                                             | © Facebook, Inc. and contributors                |
| @react‑spring/parallax             | ^9.7.3         | MIT                                             | © react‑spring contributors                      |
| clsx                               | ^2.0.0         | MIT                                             | © Luke Edwards                                   |
| react‑range‑slider‑input           | ^3.0.7         | MIT                                             | © Gabrielius Kuprys                              |
| @fortawesome/fontawesome‑svg‑core  | ^6.5.1         | MIT                                             | © Fonticons, Inc.                                |
| @fortawesome/free‑brands‑svg‑icons | ^6.5.1         | CC BY 4.0 for icon artwork; MIT for SVG/JS code | Brand trademarks remain property of their owners |
| @fortawesome/react‑fontawesome     | ^0.2.0         | MIT                                             | © FortAwesome LLC                                |

**NOTE ON FONT AWESOME FREE ICONS**
The **icon artwork** is licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0).  When redistributed, you **must** provide attribution to "Font Awesome" and include a link to [https://fontawesome.com](https://fontawesome.com).  The **JavaScript and SVG helper code** is MIT‑licensed.

---

## ASSETS FOLDER

Graphics, audio prompts, and any other non‑code assets bundled in `assets` and `public` each carry their own license notices, enumerated in the companion file `ASSETS_LICENSES.md`.  Where an asset's license requires attribution (e.g., CC‑BY), that attribution is reproduced in that file.

---

## TRADEMARKS

"React" is a trademark of Meta Platforms, Inc. "Font Awesome" is a trademark of Fonticons, Inc.  All other trademarks are the property of their respective owners and are used only for identification purposes.

---

## HOW TO UPDATE THIS FILE

1. **Add new dependencies**: run `npm ls --json --long` or a license scanner (e.g., `license‑checker`, `oss‑review‑toolkit`) and append any new packages with their license info.
2. **Check for license changes** when upgrading package versions.
3. **Review asset attributions** in `ASSETS‑LICENSES.md` whenever you add or remove images, audio, or fonts.

Last updated: 23 June 2025
