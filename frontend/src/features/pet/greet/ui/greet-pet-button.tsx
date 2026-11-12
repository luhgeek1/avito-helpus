import { MessageCircle } from "lucide-react";
export function GreetPetButton({ onGreet, className }: { onGreet: () => void; className?: string }) {
  return (
    <button className={className} onClick={onGreet}>
      <MessageCircle size={15} className="max-sm:w-3.25" />
      Поздороваться
    </button>
  );
}
