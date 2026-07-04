# Direct Optimize Portal Landing Page

The folder also includes `homepage-portal-section.html`, a compact homepage teaser that links visitors to the full portal landing page and registration form.

## WordPress setup

1. Upload `assets/client-progress.png` and `assets/employee-workspace.png` to the WordPress Media Library.
2. Open `portal-landing.html` and replace every `assets/client-progress.png` and `assets/employee-workspace.png` value with the corresponding Media Library URL.
3. Paste the complete contents of `portal-landing.html` into a WordPress **Custom HTML** block.
4. Keep the page template's normal Direct Optimize header and footer; this block intentionally contains neither.

For the homepage, repeat the same image replacement in `homepage-portal-section.html`, then paste that file into a separate Custom HTML block. Its full-page button currently points to `https://directoptimize.com/client-portal/`; change that URL if the final WordPress page uses a different slug.

The registration and login buttons already point to the live Direct Optimize portal.

## Included interactions

- Client, employee, and admin view tabs
- FAQ accordion
- Desktop, tablet, and mobile layouts
- Namespaced styles that do not target WordPress theme elements outside `.do-portal`
