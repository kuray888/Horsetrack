import { useState } from "react";
import { pickAndPersistImage } from "@/lib/imagePicker";
import { useAgenda, type Doc, type DocumentCategory } from "@/agenda/store";

const emptyDocForm = {
  category: "facture" as DocumentCategory,
  name: "",
  date: null as Date | null,
  fileUri: null as string | null,
};

export type DocumentFormValue = typeof emptyDocForm;

type AgendaActions = ReturnType<typeof useAgenda>;

/** État + logique du formulaire de document (création/édition) d'AgendaScreen
 * — extrait tel quel, aucun changement de comportement (cf. plan Phase 3
 * Étape 1). `onEditStart` reproduit l'effet de bord que `startEditDoc` faisait
 * déjà (fermer la carte dépliée avant d'ouvrir le formulaire). */
export function useDocumentForm({
  addDocument,
  updateDocument,
  onEditStart,
}: {
  addDocument: AgendaActions["addDocument"];
  updateDocument: AgendaActions["updateDocument"];
  onEditStart: () => void;
}) {
  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState(emptyDocForm);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  function startEditDoc(doc: Doc) {
    setEditingDocId(doc.id);
    setDocForm({ category: doc.category, name: doc.name, date: doc.date, fileUri: doc.fileUri });
    onEditStart();
    setShowDocForm(true);
  }

  function cancelDocForm() {
    setShowDocForm(false);
    setEditingDocId(null);
    setDocForm(emptyDocForm);
  }

  function handleSubmitDocument() {
    const date = docForm.date;
    if (!docForm.name.trim() || !date) return;
    if (editingDocId) {
      updateDocument(editingDocId, { category: docForm.category, name: docForm.name.trim(), date, fileUri: docForm.fileUri });
    } else {
      addDocument({ category: docForm.category, name: docForm.name.trim(), date, fileUri: docForm.fileUri });
    }
    cancelDocForm();
  }

  async function handlePickDocPhoto() {
    const uri = await pickAndPersistImage();
    if (uri) setDocForm((f) => ({ ...f, fileUri: uri }));
  }

  return {
    showDocForm,
    setShowDocForm,
    docForm,
    setDocForm,
    editingDocId,
    startEditDoc,
    cancelDocForm,
    handleSubmitDocument,
    handlePickDocPhoto,
  };
}
