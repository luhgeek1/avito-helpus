import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Volume2, X } from "lucide-react";
import { PixelPet, usePetPreferences } from "@/entities/pet";
import { useCompanionPosition } from "../model/use-companion-position";
export function PetCompanion() {
  const { chosenPet, paused, selectionVersion } = usePetPreferences();
  const [widgetVisible, setWidgetVisible] = useState(true);
  const [widgetSpeaking, setWidgetSpeaking] = useState(false);
  const movement = useCompanionPosition(Boolean(chosenPet) && widgetVisible);
  useEffect(() => {
    if (selectionVersion > 0) {
      setWidgetVisible(true);
      setWidgetSpeaking(true);
    }
  }, [selectionVersion]);
  useEffect(() => {
    if (!widgetSpeaking) return;
    const timer = setTimeout(() => setWidgetSpeaking(false), 7000);
    return () => clearTimeout(timer);
  }, [widgetSpeaking, selectionVersion]);
  return (
    <>
      {chosenPet && widgetVisible && (
        <div
