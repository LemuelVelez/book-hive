import { SidebarHeader, useSidebar } from "@/components/ui/sidebar"
import logo from "@/assets/images/logo.svg"

export function NavHeader() {
    const { state } = useSidebar()
    const collapsed = state === "collapsed"

    return (
        <SidebarHeader>
            {collapsed ? (
                // Collapsed: centered logo only (prevents overflow)
                <div className="flex items-center justify-center px-0.5 py-2">
                    <img
                        src={logo}
                        alt="Book-Hive"
                        className="h-7 w-7 rounded-md object-cover"
                    />
                    <span className="sr-only">JRMSU-TC • Book-Hive</span>
                </div>
            ) : (
                // Expanded
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <img
                        src={logo}
                        alt="Book-Hive"
                        className="h-7 w-7 rounded-md object-cover"
                    />
                    <div className="flex flex-col leading-tight">
                        <span className="font-semibold">JRMSU-TC</span>
                        <span className="text-xs opacity-70">Book-Hive</span>
                    </div>
                </div>
            )}
        </SidebarHeader>
    )
}
