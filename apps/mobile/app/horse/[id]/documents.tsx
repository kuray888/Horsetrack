import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { colors } from "@/theme/colors";
import { useHorses } from "@/horses/store";
import { useAgenda, type Doc } from "@/agenda/store";
import { DocumentForm } from "@/agenda/components/DocumentForm";
import { DocumentCard } from "@/agenda/components/DocumentCard";
import { useDocumentForm } from "@/agenda/hooks/useDocumentForm";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/**
 * Coffre-fort de documents d'UN cheval — carnet de vaccination, licence,
 * factures. Reprend la section « documents » de l'ancien écran Agenda, sans
 * changement de comportement : mêmes composants (DocumentForm/DocumentCard),
 * même hook, mêmes données.
 *
 * Vit ici plutôt que dans un onglet parce que c'est ce que la fiche cheval
 * annonçait déjà : son module « Documents » pointait vers Agenda, un écran
 * sorti de la barre d'onglets et laissé en place « le temps que son
 * remplacement soit fonctionnel » (cf. l'ancien commentaire de
 * app/(tabs)/_layout.tsx). C'est ce remplacement.
 *
 * Même forme que les autres sous-écrans de la fiche (santé, poids,
 * historique) : cadré sur le cheval de l'URL, sans toucher au cheval actif
 * global (cf. app/horse/[id]/index.tsx).
 */
export default function HorseDocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses } = useHorses();
  const { documents, addDocument, updateDocument, deleteDocument } = useAgenda();

  const horse = horses.find((h) => h.id === id);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const {
    showDocForm,
    setShowDocForm,
    docForm,
    setDocForm,
    editingDocId,
    startEditDoc,
    cancelDocForm,
    handleSubmitDocument,
    handlePickDocument,
  } = useDocumentForm({
    addDocument,
    updateDocument,
    // Cet écran ne change pas le cheval actif : il doit donc dire lui-même à
    // quel cheval rattacher le document (cf. app/horse/[id]/index.tsx).
    horse: horse ?? null,
    onEditStart: () => setExpandedDocId(null),
  });

  if (!horse) {
    return (
      <Screen>
        <FadeInView>
          <View className={`${CARD} items-center gap-2`}>
            <MaterialCommunityIcons name="horse-variant" size={28} color={colors.textMuted} />
            <Text className="text-sm text-muted">Ce cheval est introuvable.</Text>
          </View>
        </FadeInView>
      </Screen>
    );
  }

  // Documents de CE cheval seulement, le plus récent en premier — même tri
  // que l'ancien écran Agenda.
  const sortedDocs = documents
    .filter((d) => d.horseId === horse.id)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  function confirmDeleteDocument(doc: Doc) {
    Alert.alert(
      `Supprimer « ${doc.name} » ?`,
      "Ce document sera définitivement supprimé et ne pourra pas être récupéré.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => deleteDocument(doc.id) },
      ]
    );
  }

  return (
    <>
      <Screen>
        <FadeInView>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-0.5 pr-3">
              <Text className="text-2xl font-display tracking-tight text-text">Documents</Text>
              <Text className="text-sm text-muted">Coffre-fort numérique de {horse.name}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityLabel="Fermer"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </FadeInView>

        <FadeInView delay={40}>
          <DocumentForm
            show={showDocForm}
            form={docForm}
            setForm={setDocForm}
            editingDocId={editingDocId}
            onOpen={() => setShowDocForm(true)}
            onCancel={cancelDocForm}
            onSubmit={handleSubmitDocument}
            onPickDocument={handlePickDocument}
          />
        </FadeInView>

        {sortedDocs.length === 0 ? (
          <FadeInView delay={80}>
            <View className={`${CARD} items-center gap-2`}>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                <MaterialCommunityIcons name="folder-outline" size={22} color={colors.textMuted} />
              </View>
              <Text className="text-center text-sm text-muted">
                Aucun document pour l&apos;instant. Carnet de vaccination, licence, factures : rangés ici, ils restent
                consultables même sans réseau.
              </Text>
              {!showDocForm ? (
                <TouchableOpacity onPress={() => setShowDocForm(true)} activeOpacity={0.7}>
                  <Text className="text-sm font-semibold text-accent">Ajouter un document</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </FadeInView>
        ) : (
          sortedDocs.map((doc, i) => (
            <FadeInView key={doc.id} delay={80 + i * 60}>
              <DocumentCard
                doc={doc}
                expanded={expandedDocId === doc.id}
                onToggleExpand={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}
                onDelete={() => confirmDeleteDocument(doc)}
                onEdit={() => startEditDoc(doc)}
              />
            </FadeInView>
          ))
        )}
      </Screen>
      <PickerOverlaySlot />
    </>
  );
}
