import TypingEffect from "./ui/typing-effect";
export default function Demo() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <TypingEffect texts={["Design", "Development", "Marketing"]} />
    </div>
  );
}
