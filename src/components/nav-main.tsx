import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuBadge,
} from "@/components/ui/sidebar"
import {
    Home,
    BookOpen,
    Bookmark,
    Library,
    MessageSquare,
    CreditCard,
    Settings,
    HelpCircle,
} from "lucide-react"
import { toast } from "sonner"

type Item = {
    label: string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    to?: string
    badge?: string | number
    soon?: boolean
}

export function NavMain() {
    const location = useLocation()
    const navigate = useNavigate()

    // Only the overview actually routes; others just toast (mock).
    const items: Item[] = [
        { label: "Overview", icon: Home, to: "/dashboard/student" },
        { label: "My Loans", icon: BookOpen, soon: true, badge: 2 },
        { label: "Reservations", icon: Bookmark, soon: true, badge: 1 },
        { label: "Catalog", icon: Library, soon: true },
        { label: "Messages", icon: MessageSquare, soon: true, badge: 3 },
        { label: "Fines & Dues", icon: CreditCard, soon: true },
        { label: "Settings", icon: Settings, soon: true },
        { label: "Help", icon: HelpCircle, soon: true },
    ]

    function handleClick(item: Item) {
        if (item.to) {
            navigate(item.to)
            return
        }
        toast.info(`${item.label} (mock)`, {
            description: "This section is not wired yet.",
        })
    }

    return (
        <SidebarGroup>
            <SidebarGroupLabel className="text-white/70">Student</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => {
                        const Icon = item.icon
                        const isActive = !!item.to && location.pathname.startsWith(item.to)

                        return (
                            <SidebarMenuItem key={item.label}>
                                {item.to ? (
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
                                ) : (
                                    <SidebarMenuButton
                                        onClick={() => handleClick(item)}
                                        isActive={false}
                                        tooltip={item.label}
                                        className="hover:bg-white/10"
                                    >
                                        <Icon />
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                )}

                                {item.badge ? (
                                    <SidebarMenuBadge className="bg-white/10 text-white">{item.badge}</SidebarMenuBadge>
                                ) : null}
                            </SidebarMenuItem>
                        )
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
