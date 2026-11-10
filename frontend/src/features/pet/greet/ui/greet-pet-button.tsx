import { MessageCircle } from "lucide-react";
export function GreetPetButton({ onGreet }: { onGreet: () => void }) {
  return (
    <button onClick={onGreet}>
      <MessageCircle size={15} />
      Поздороваться
    </button>
  );
}
