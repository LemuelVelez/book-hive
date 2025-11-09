import { SidebarSeparator, useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { HelpCircle } from "lucide-react"
import { toast } from "sonner"

export function NavFooter() {
    const { state } = useSidebar()
    const collapsed = state === "collapsed"

    const onSupport = () =>
        toast.message("Support (mock)", { description: "Email support@example.com" })

    if (collapsed) {
        // Collapsed: compact footer — tiny version text + icon-only support button
        return (
            <div className="px-2 pt-2">
                <SidebarSeparator className="bg-white/10" />
                <div className="flex flex-col items-center gap-2 py-2">
                    <span className="text-[10px] opacity-60">v0.1.0</span>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 border-white/20 text-white/90 hover:bg-white/10"
                        onClick={onSupport}
                        aria-label="Contact Support"
                        title="Contact Support"
                    >
                        <HelpCircle className="h-4 w-4" />
                        <span className="sr-only">Contact Support</span>
                    </Button>
                </div>
            </div>
        )
    }

    // Expanded
    return (
        <div className="px-2 pt-2">
            <SidebarSeparator className="bg-white/10" />
            <div className="px-2 py-2 text-xs opacity-70">v0.1.0 • Mock build</div>
            <div className="px-2 pb-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/20 text-white/90 hover:bg-white/10"
                    onClick={onSupport}
                >
                    Contact Support
                </Button>
            </div>
        </div>
    )
}
