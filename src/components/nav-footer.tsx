import { SidebarSeparator, useSidebar } from "@/components/ui/sidebar"

export function NavFooter() {
    const { state } = useSidebar()
    const collapsed = state === "collapsed"

    // When collapsed: center the separator and make it shorter
    // When expanded: keep the previous full-width subtle separator
    return (
        <div
            className={
                collapsed
                    ? "px-0 pt-2 pb-2 flex justify-center"
                    : "px-2 pt-2 pb-2"
            }
        >
            <SidebarSeparator
                className={
                    collapsed
                        ? "bg-white/10 mx-auto w-8"
                        : "bg-white/10"
                }
            />
        </div>
    )
}
