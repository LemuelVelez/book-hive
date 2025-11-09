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
    return (
        <div className="min-h-screen bg-slate-900 text-white">
            <SidebarProvider defaultOpen>
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

                {/* Slim rail to toggle (desktop) */}
                <SidebarRail className="border-white/10" />

                <SidebarInset className="bg-transparent">
                    <DashboardHeader title={title} />
                    <div className="p-4 md:p-6">{children}</div>
                </SidebarInset>
            </SidebarProvider>
        </div>
    )
}
