import Link from '@docusaurus/Link'
import { useLocation } from '@docusaurus/router'
import useBaseUrl from '@docusaurus/useBaseUrl'
import { type ReactElement, useEffect, useRef } from 'react'

/**
 * Swizzled (replace) version of theme/Navbar/MobileSidebar/PrimaryMenu.
 *
 * Replaces the default primary→secondary drawer flow with a single flat list
 * that mirrors the desktop navbar/sidebar.
 *
 * Two mechanics worth knowing about:
 *
 * 1. `inert` cleanup. On doc pages the doc plugin contributes a
 *    `MobileSecondaryMenuFiller`. Even though SecondaryMenu is stubbed to
 *    return null, the filler flips Docusaurus' internal secondary state and
 *    Layout sets `inert` on the PRIMARY `.navbar-sidebar__item` — making these
 *    links visible but unclickable. A MutationObserver strips it.
 * 2. Drawer close. The drawer doesn't auto-close after the swizzle, so each
 *    link tap fires `.navbar-sidebar__close` on the next tick.
 *
 * Items are kept in sync with the navbar in apps/docs/docusaurus.config.ts by hand.
 */

type Item = {
	label: string
	to?: string
	href?: string
}

const ITEMS: Item[] = [
	{ label: 'Docs', to: '/docs' },
	{ label: 'Guides', to: '/docs/guides' },
	{ label: 'Reference', to: '/docs/reference' },
	{ label: 'Changelog', to: '/docs/changelog' },
	{ label: 'GitHub', href: 'https://github.com/rtorcato/js-tooling' },
	{ label: 'npm', href: 'https://www.npmjs.com/package/@rtorcato/js-tooling' },
]

function closeDrawer(): void {
	if (typeof document === 'undefined') return
	const closeButton = document.querySelector<HTMLButtonElement>('.navbar-sidebar__close')
	setTimeout(() => closeButton?.click(), 0)
}

function MenuLink({ item }: { item: Item }): ReactElement {
	const { pathname } = useLocation()
	const resolved = useBaseUrl(item.to ?? '/')
	const isActive = item.to !== undefined && pathname === resolved
	const isExternal = item.href !== undefined

	const className = [
		'jt-mobile-menu__link',
		isActive && 'jt-mobile-menu__link--active',
		isExternal && 'jt-mobile-menu__external',
	]
		.filter(Boolean)
		.join(' ')

	const linkProps = item.href ? { href: item.href } : { to: item.to ?? '/' }

	return (
		<li>
			<Link
				className={className}
				{...linkProps}
				onClick={closeDrawer}
				aria-current={isActive ? 'page' : undefined}
			>
				{item.label}
			</Link>
		</li>
	)
}

export default function NavbarMobilePrimaryMenu(): ReactElement {
	const ref = useRef<HTMLUListElement>(null)

	useEffect(() => {
		const panel = ref.current?.closest<HTMLElement>('.navbar-sidebar__item')
		if (!panel) return

		const strip = () => {
			if (panel.hasAttribute('inert')) panel.removeAttribute('inert')
		}
		strip()

		const observer = new MutationObserver(strip)
		observer.observe(panel, { attributes: true, attributeFilter: ['inert'] })
		return () => observer.disconnect()
	}, [])

	return (
		<ul ref={ref} className="jt-mobile-menu">
			{ITEMS.map((item) => (
				<MenuLink key={item.label} item={item} />
			))}
		</ul>
	)
}
