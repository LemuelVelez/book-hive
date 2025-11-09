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
import { Home } from "lucide-react"

type Item = {
    label: string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    to: string
}

export function NavMain() {
    const location = useLocation()

    const items: Item[] = [
        { label: "Overview", icon: Home, to: "/dashboard/student" },
    ]

    return (
        <SidebarGroup>
            <SidebarGroupLabel className="text-white/70">Student</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname.startsWith(item.to)

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
