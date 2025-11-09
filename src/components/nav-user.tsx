/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNavigate } from "react-router-dom"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { logout as apiLogout } from "@/lib/authentication"

// Mock identity (replace when wiring to session)
const ME = {
    name: "User Name",
    email: "user@jrmsu.edu.ph",
    avatarUrl: "",
}

export function NavUser() {
    const navigate = useNavigate()
    const { state } = useSidebar()
    const collapsed = state === "collapsed"

    async function onLogout() {
        try {
            await apiLogout() // calls POST /api/auth/logout and clears cookie
            toast.success("You’ve been logged out.")
            navigate("/", { replace: true })
        } catch (err: any) {
            // apiLogout already swallows errors, but just in case:
            const msg = String(err?.message || "Failed to log out. Please try again.")
            toast.error("Logout failed", { description: msg })
        }
    }

    const initials = ME.name
        .split(" ")
        .map((s) => s[0])
        .join("")
        .slice(0, 2)

    // Collapsed: show only a centered circular avatar
    if (collapsed) {
        return (
            <SidebarMenu>
                <SidebarMenuItem className="flex justify-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                                aria-label={`${ME.name} account menu`}
                            >
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={ME.avatarUrl} alt={ME.name} />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="start"
                            side="top"
                            className="w-[220px] bg-slate-900 text-white border-white/10"
                        >
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                        <AvatarImage src={ME.avatarUrl} alt={ME.name} />
                                        <AvatarFallback>{initials}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-xs">
                                        <div className="font-medium">{ME.name}</div>
                                        <div className="opacity-70">{ME.email}</div>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                                onClick={() => toast.info("Profile (mock)")}
                                className="focus:bg-white/10"
                            >
                                Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => toast.info("Settings (mock)")}
                                className="focus:bg-white/10"
                            >
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                                onClick={onLogout}
                                className="text-red-400 focus:bg-red-500/10"
                            >
                                Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>
        )
    }

    // Expanded: original layout with avatar + name + email
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="data-[active=true]:bg-transparent">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={ME.avatarUrl} alt={ME.name} />
                                <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{ME.name}</span>
                                <span className="truncate text-xs opacity-70">{ME.email}</span>
                            </div>
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        side="top"
                        className="w-[220px] bg-slate-900 text-white border-white/10"
                    >
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                    <AvatarImage src={ME.avatarUrl} alt={ME.name} />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="text-xs">
                                    <div className="font-medium">{ME.name}</div>
                                    <div className="opacity-70">{ME.email}</div>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem
                            onClick={() => toast.info("Profile (mock)")}
                            className="focus:bg-white/10"
                        >
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => toast.info("Settings (mock)")}
                            className="focus:bg-white/10"
                        >
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem
                            onClick={onLogout}
                            className="text-red-400 focus:bg-red-500/10"
                        >
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
