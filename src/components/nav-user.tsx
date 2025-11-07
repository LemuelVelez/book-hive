import { useNavigate } from "react-router-dom"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
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

// Mock identity (replace when wiring to session)
const ME = {
    name: "Lemuel Velez",
    email: "lemuel@jrmsu.edu.ph",
    avatarUrl: "",
}

export function NavUser() {
    const navigate = useNavigate()

    function onLogout() {
        toast.success("Logged out (mock)")
        navigate("/auth", { replace: true })
    }

    const initials = ME.name
        .split(" ")
        .map((s) => s[0])
        .join("")
        .slice(0, 2)

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
                        <DropdownMenuItem onClick={() => toast.info("Profile (mock)")} className="focus:bg-white/10">
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Settings (mock)")} className="focus:bg-white/10">
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={onLogout} className="text-red-400 focus:bg-red-500/10">
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
