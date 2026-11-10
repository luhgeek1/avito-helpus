import { PetPreferencesProvider } from "@/entities/pet";
import { HomePage } from "@/pages/home";
import { PetGalleryPage } from "@/pages/pet-gallery";
import { PetCompanion } from "@/widgets/pet-companion";
import { WorkspaceShell } from "@/widgets/workspace-shell";
import { useRoute } from "./router/use-route";
export function App() {
  const { page, navigate } = useRoute();
  return (
    <PetPreferencesProvider>
      <WorkspaceShell
        page={page}
        navigate={navigate}
        companion={<PetCompanion />}
      >
        {page === "pets" ? (
          <PetGalleryPage />
        ) : (
          <HomePage onOpenGallery={() => navigate("pets")} />
        )}
      </WorkspaceShell>
    </PetPreferencesProvider>
  );
}
