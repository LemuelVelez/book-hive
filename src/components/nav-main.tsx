import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Home, BookOpen, Users2 } from "lucide-react"

type Item = {
    label: string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    to: string
    /** If true, active only when pathname === to */
    exact?: boolean
}

export function NavMain() {
    const location = useLocation()
    const pathname = location.pathname

    let groupLabel = "Dashboard"
    let items: Item[] = [
        // Fallback for /dashboard root or unknown
        { label: "Overview", icon: Home, to: "/dashboard", exact: true },
    ]

    // Derive section from URL instead of calling /api/auth/me
    if (pathname.startsWith("/dashboard/student")) {
        groupLabel = "Student"
        items = [
            {
                label: "Overview",
                icon: Home,
                to: "/dashboard/student",
                exact: true,
            },
        ]
    } else if (pathname.startsWith("/dashboard/librarian")) {
        groupLabel = "Librarian"
        items = [
            {
                label: "Overview",
                icon: Home,
                to: "/dashboard/librarian",
                exact: true,
            },
            {
                label: "Books",
                icon: BookOpen,
                to: "/dashboard/librarian/books",
                // exact: false by default – stays active for nested routes
            },
            // ✅ New: Users (read-only)
            {
                label: "Users",
                icon: Users2,
                to: "/dashboard/librarian/users",
            },
        ]
    } else if (pathname.startsWith("/dashboard/faculty")) {
        groupLabel = "Faculty"
        items = [
            {
                label: "Overview",
                icon: Home,
                to: "/dashboard/faculty",
                exact: true,
            },
        ]
    } else if (pathname.startsWith("/dashboard/admin")) {
        groupLabel = "Admin"
        items = [
            {
                label: "Overview",
                icon: Home,
                to: "/dashboard/admin",
                exact: true,
            },
        ]
    }

    return (
        <SidebarGroup>
            <SidebarGroupLabel className="text-white/70">
                {groupLabel}
            </SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => {
                        const Icon = item.icon

                        // Exact items (Overview) only active on exact route
                        // Non-exact items (Books, Users, etc.) are active on /to or /to/...
                        const isActive = item.exact
                            ? pathname === item.to
                            : pathname === item.to ||
                            pathname.startsWith(item.to + "/")

                        return (
                            <SidebarMenuItem key={item.label}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isActive}
                                    tooltip={item.label}
                                    className="data-[active=true]:bg-white/10"
                                >
                                    <Link to={item.to}>
                                        <Icon />
                                        <span>{item.label}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
