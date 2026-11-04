import { useEffect } from "react";

/**
 * Gives a section of the app its own tab title and favicon (the sales panel
 * shares app.healvo.in with the clinic app), restoring the defaults on leave.
 */
export function usePageIdentity(title: string, iconHref: string) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const previousTitle = document.title;
    const previousIcon = link?.getAttribute("href") ?? null;
    document.title = title;
    link?.setAttribute("href", iconHref);
    return () => {
      document.title = previousTitle;
      if (link && previousIcon) link.setAttribute("href", previousIcon);
    };
  }, [title, iconHref]);
}
