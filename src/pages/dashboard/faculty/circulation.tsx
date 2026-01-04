import StudentCirculationPage from "@/pages/dashboard/student/circulation"

export default function FacultyCirculationPage() {
    // Faculty circulation uses the same "My Circulation" experience as borrowers
    return <StudentCirculationPage />
}
