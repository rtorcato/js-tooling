/**
 * Swizzled (replace) SecondaryMenu — disabled.
 *
 * The doc plugin contributes a sidebar filler that flips the mobile drawer into
 * "secondary" mode on doc pages, translating the primary menu off screen. We
 * don't want that flow: the swizzled PrimaryMenu already renders the full
 * menu. Returning null keeps the secondary slot empty; CSS in custom.css locks
 * the items container so the primary stays in view.
 */
export default function NavbarMobileSidebarSecondaryMenu(): null {
	return null
}
