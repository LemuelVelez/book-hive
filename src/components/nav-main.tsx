// src/components/nav-main.tsx
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
    BarChart3,
} from "lucide-react"
import { me as apiMe, type Role } from "@/lib/authentication"
import {
    BORROW_NOTIFICATION_SYNC_EVENT,
    fetchBorrowNotificationSummary,
} from "@/lib/borrows"

type Item = {
    label: string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    to: string
    exact?: boolean
    badgeCount?: number
}

const ROLE_STORAGE_KEY = "bookhive.currentRole"
const BORROW_NOTIFICATION_POLL_MS = 30000

function normalizeNotificationCount(value: unknown): number {
    const numeric = Math.floor(Number(value))
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

function formatNotificationBadge(count: number): string {
    return count > 99 ? "99+" : String(count)
}

function readCachedRole(): Role | null | undefined {
    if (typeof window === "undefined") return undefined
    const raw = window.sessionStorage.getItem(ROLE_STORAGE_KEY)?.trim()
    return raw ? (raw as Role) : undefined
}

function writeCachedRole(role: Role | null | undefined) {
    if (typeof window === "undefined") return

    if (role) {
        window.sessionStorage.setItem(ROLE_STORAGE_KEY, role)
        return
    }

    window.sessionStorage.removeItem(ROLE_STORAGE_KEY)
}

export function NavMain() {
    const location = useLocation()
    const pathname = location.pathname

    const [currentRole, setCurrentRole] = React.useState<Role | null | undefined>(() => readCachedRole())
    const [borrowNotificationCount, setBorrowNotificationCount] = React.useState(0)

    React.useEffect(() => {
        let cancelled = false

        ; (async () => {
            try {
                const user = await apiMe()
                if (!cancelled) {
                    const role = (user?.role ?? user?.accountType ?? null) as Role | null
                    setCurrentRole(role)
                    writeCachedRole(role)
                }
            } catch {
                if (!cancelled) {
                    setCurrentRole((prev) => prev ?? null)
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [])

    const isLibrarian = pathname.startsWith("/dashboard/librarian")
    const isAssistantSection = pathname.startsWith("/dashboard/assistant-librarian")
    const isFaculty = pathname.startsWith("/dashboard/faculty")
    const isAdmin = pathname.startsWith("/dashboard/admin")

    const isBorrowerSection =
        pathname.startsWith("/dashboard") &&
        !isLibrarian &&
        !isAssistantSection &&
        !isFaculty &&
        !isAdmin

    const canSeeBorrowRecordNotifications =
        currentRole === "assistant_librarian" ||
        currentRole === "librarian" ||
        isLibrarian ||
        isAssistantSection

    React.useEffect(() => {
        if (!canSeeBorrowRecordNotifications) {
            setBorrowNotificationCount(0)
            return
        }

        let cancelled = false

        const loadBorrowNotifications = async () => {
            try {
                const summary = await fetchBorrowNotificationSummary()
                if (!cancelled) {
                    setBorrowNotificationCount(normalizeNotificationCount(summary.actionableCount))
                }
            } catch {
                if (!cancelled) {
                    setBorrowNotificationCount(0)
                }
            }
        }

        void loadBorrowNotifications()

        const intervalId = window.setInterval(() => {
            void loadBorrowNotifications()
        }, BORROW_NOTIFICATION_POLL_MS)

        const handleWindowFocus = () => {
            void loadBorrowNotifications()
        }

        const handleBorrowNotificationSync = () => {
            void loadBorrowNotifications()
        }

        window.addEventListener("focus", handleWindowFocus)
        window.addEventListener(BORROW_NOTIFICATION_SYNC_EVENT, handleBorrowNotificationSync)

        return () => {
            cancelled = true
            window.clearInterval(intervalId)
            window.removeEventListener("focus", handleWindowFocus)
            window.removeEventListener(BORROW_NOTIFICATION_SYNC_EVENT, handleBorrowNotificationSync)
        }
    }, [canSeeBorrowRecordNotifications, pathname])

    let groupLabel = "Dashboard"
    let items: Item[] = [
        { label: "Dashboard", icon: Home, to: "/dashboard", exact: true },
    ]

    const isAssistantLibrarian = currentRole === "assistant_librarian"
    const assistantBasePath = isAssistantSection
        ? "/dashboard/assistant-librarian"
        : "/dashboard/librarian"

    const assistantLibrarianItems: Item[] = [
        {
            label: "Dashboard",
            icon: Home,
            to: assistantBasePath,
            exact: true,
        },
        {
            label: "Borrow Records",
            icon: ListChecks,
            to: `${assistantBasePath}/borrow-records`,
            badgeCount: borrowNotificationCount,
        },
        {
            label: "Settings",
            icon: Settings,
            to: `${assistantBasePath}/settings`,
        },
    ]

    if (isBorrowerSection) {
        groupLabel = "My Library"
        items = [
            {
                label: "Dashboard",
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
                label: "Borrowed Books",
                icon: ListChecks,
                to: "/dashboard/borrowed-books",
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
    } else if (isLibrarian || isAssistantSection) {
        if (currentRole === undefined || currentRole === null || isAssistantLibrarian || isAssistantSection) {
            groupLabel = "Assistant Librarian"
            items = assistantLibrarianItems
        } else {
            groupLabel = "Librarian"
            items = [
                {
                    label: "Dashboard",
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
                    badgeCount: borrowNotificationCount,
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
                    label: "Statistics",
                    icon: BarChart3,
                    to: "/dashboard/librarian/statistics",
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
        }
    } else if (isFaculty) {
        groupLabel = "Faculty"
        items = [
            {
                label: "Dashboard",
                icon: Home,
                to: "/dashboard/faculty",
                exact: true,
            },
            {
                label: "Books",
                icon: BookOpen,
                to: "/dashboard/faculty/books",
            },
            {
                label: "Borrowed Books",
                icon: ListChecks,
                to: "/dashboard/faculty/borrowed-books",
            },
            {
                label: "Fines",
                icon: ReceiptText,
                to: "/dashboard/faculty/fines",
            },
            {
                label: "Insights Hub",
                icon: MessageSquare,
                to: "/dashboard/faculty/insights",
            },
            {
                label: "Settings",
                icon: Settings,
                to: "/dashboard/faculty/settings",
            },
        ]
    } else if (isAdmin) {
        groupLabel = "Admin"
        items = [
            {
                label: "Dashboard",
                icon: Home,
                to: "/dashboard/admin",
                exact: true,
            },
            {
                label: "Analytics",
                icon: BarChart3,
                to: "/dashboard/admin/analytics",
            },
            {
                label: "Users",
                icon: Users2,
                to: "/dashboard/admin/users",
            },
            {
                label: "Settings",
                icon: Settings,
                to: "/dashboard/admin/settings",
            },
        ]
    }

    return (
        <SidebarGroup>
            <SidebarGroupLabel className="text-white/70">{groupLabel}</SidebarGroupLabel>

            <SidebarGroupContent>
                <div className="support-scroll overflow-x-auto overflow-y-visible whitespace-nowrap pr-1">
                    <SidebarMenu className="min-w-full">
                        {items.map((item) => {
                            const Icon = item.icon

                            const isActive = item.exact
                                ? pathname === item.to
                                : pathname === item.to || pathname.startsWith(item.to + "/")

                            return (
                                <SidebarMenuItem key={item.label} className="whitespace-nowrap">
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive}
                                        tooltip={item.label}
                                        className="data-[active=true]:bg-white/10"
                                    >
                                        <Link to={item.to} className="flex w-full items-center gap-2">
                                            <Icon />
                                            <span className="min-w-0 flex-1">{item.label}</span>
                                            {item.badgeCount ? (
                                                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                                                    {formatNotificationBadge(item.badgeCount)}
                                                </span>
                                            ) : null}
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