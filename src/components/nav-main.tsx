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
import {
    Home,
    BookOpen,
    Users2,
    ListChecks,
    MessageSquare,
    ShieldAlert,
    ReceiptText,
    Settings,
    Coins,
} from "lucide-react"

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

    // Borrower (Student + Other) section:
    // All borrower routes are under /dashboard (excluding librarian/faculty/admin subpaths)
    const isLibrarian = pathname.startsWith("/dashboard/librarian")
    const isFaculty = pathname.startsWith("/dashboard/faculty")
    const isAdmin = pathname.startsWith("/dashboard/admin")

    const isBorrowerSection =
        pathname.startsWith("/dashboard") &&
        !isLibrarian &&
        !isFaculty &&
        !isAdmin

    if (isBorrowerSection) {
        // Shared navigation for "student" and "other" roles
        groupLabel = "My Library"
        items = [
            {
                label: "Overview",
                icon: Home,
                to: "/dashboard",
                exact: true,
            },
            {
                label: "Books",
                icon: BookOpen,
                to: "/dashboard/books",
            },
            {
                label: "Circulation",
                icon: ListChecks,
                to: "/dashboard/circulation",
            },
            {
                label: "Fines",
                icon: ReceiptText,
                to: "/dashboard/fines",
            },
            {
                label: "Insights Hub",
                icon: MessageSquare,
                to: "/dashboard/insights",
            },
            {
                label: "Settings",
                icon: Settings,
                to: "/dashboard/settings",
            },
        ]
    } else if (isLibrarian) {
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
            },
            {
                label: "Borrow Records",
                icon: ListChecks,
                to: "/dashboard/librarian/borrow-records",
            },
            {
                label: "Fines",
                icon: ReceiptText,
                to: "/dashboard/librarian/fines",
            },
            {
                label: "Income",
                icon: Coins,
                to: "/dashboard/librarian/income",
            },
            {
                label: "Damage Reports",
                icon: ShieldAlert,
                to: "/dashboard/librarian/damage-reports",
            },
            {
                label: "Feedbacks",
                icon: MessageSquare,
                to: "/dashboard/librarian/feedbacks",
            },
            {
                label: "Users",
                icon: Users2,
                to: "/dashboard/librarian/users",
            },
            {
                label: "Settings",
                icon: Settings,
                to: "/dashboard/librarian/settings",
            },
        ]
    } else if (isFaculty) {
        groupLabel = "Faculty"
        items = [
            {
                label: "Overview",
                icon: Home,
                to: "/dashboard/faculty",
                exact: true,
            },
        ]
    } else if (isAdmin) {
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
                {/* Horizontal scroll for tight layouts, styled by .support-scroll */}
                <div className="support-scroll overflow-x-auto overflow-y-visible whitespace-nowrap pr-1">
                    <SidebarMenu className="min-w-full">
                        {items.map((item) => {
                            const Icon = item.icon

                            const isActive = item.exact
                                ? pathname === item.to
                                : pathname === item.to || pathname.startsWith(item.to + "/")

                            return (
                                <SidebarMenuItem
                                    key={item.label}
                                    className="whitespace-nowrap"
                                >
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
                </div>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
