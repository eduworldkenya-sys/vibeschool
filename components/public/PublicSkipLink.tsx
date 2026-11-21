/**
 * Native fragment navigation works before, during and after React hydration.
 * This server component does not attach a click handler or replace the anchor.
 */
export function PublicSkipLink({className,children}:{className:string;children:string}) {
 return <a href="#main-content" className={className}>{children}</a>
}
