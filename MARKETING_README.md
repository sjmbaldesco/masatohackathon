# PASADA Marketing Screenshot Suite

This directory contains a specialized Playwright automation suite designed explicitly to capture ultra-high-resolution, cinematic screenshots for Google Flow (Veo) video generation.

## Objective
To instantly generate a massive library of 100% accurate, high-fidelity marketing assets without manual cropping, waiting for loaders, or hiding browser chrome.

## Resolutions
The suite utilizes precise scaling to achieve Apple-level marketing asset sizes:
*   **Desktop App (Admin/TOC)**: 2560 × 1600 (Native 16" Retina)
*   **Mobile Apps (Passenger/Driver)**: 1290 × 2796 (Native iPhone 15 Pro Max)

## How to Run

1. Ensure your local `npm run dev` and python backend servers are running.
2. Open a terminal in the `frontend` directory.
3. Run the generator:

```bash
npm run marketing
```

## What Happens?

Playwright will autonomously:
1. Boot up two simultaneous virtual device contexts (Retina Desktop + iPhone 15 Pro).
2. Steer through the **Passenger**, **Driver**, and **Admin** flows simultaneously.
3. Inject simulated transport data.
4. Suppress all CSS scrollbars and native cursors.
5. Pause before every shot to ensure:
    * All network requests settle.
    * All fonts and map tiles load.
    * CSS and Framer Motion animations conclude.
6. Snap perfectly cropped, lossless `.png` files.

## Outputs
All screenshots are saved into the `frontend/screenshots/` directory, categorized by application domain:

*   `screenshots/auth/`
*   `screenshots/passenger/`
*   `screenshots/driver/`
*   `screenshots/cooperative/`

You can take these raw `.png` files directly into Figma, After Effects, or Google Flow (Veo) for cinematic animation.
