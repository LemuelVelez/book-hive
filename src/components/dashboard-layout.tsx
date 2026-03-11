import * as React from "react"
import {
    SidebarProvider,
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarInset,
    SidebarRail,
} from "@/components/ui/sidebar"
import { NavHeader } from "@/components/nav-header"
import { NavMain } from "@/components/nav-main"
import { NavFooter } from "@/components/nav-footer"
import { NavUser } from "@/components/nav-user"
import { DashboardHeader } from "@/components/dashboard-header"

const SIDEBAR_OPEN_STORAGE_KEY = "bookhive.sidebar.open"

function readStoredSidebarOpen() {
    if (typeof window === "undefined") return true

    const raw = window.sessionStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY)
    if (raw === null) return true
    return raw === "1"
}

function storeSidebarOpen(open: boolean) {
    if (typeof window === "undefined") return
    window.sessionStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, open ? "1" : "0")
}

/**
 * Layout wrapper for all dashboard pages.
 * Uses the responsive Sidebar and a sticky top Header.
 * Forced dark canvas to ensure no white background flashes.
 */
export default function DashboardLayout({
    title,
    children,
}: {
    title?: string
    children: React.ReactNode
}) {
    const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(() => readStoredSidebarOpen())

    React.useEffect(() => {
        storeSidebarOpen(sidebarOpen)
    }, [sidebarOpen])

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4">
            <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <Sidebar collapsible="icon" variant="inset" className="bg-slate-900 text-white border-white/10">
                    <NavHeader />
                    <SidebarContent>
                        <NavMain />
                    </SidebarContent>
                    <SidebarFooter>
                        <NavFooter />
                        <NavUser />
                    </SidebarFooter>
                </Sidebar>

                <SidebarRail className="border-white/10" />

                <SidebarInset className="bg-transparent min-w-0">
                    <DashboardHeader title={title} />
                    <div className="p-4 md:p-6">{children}</div>
                </SidebarInset>
            </SidebarProvider>
        </div>
    )
}