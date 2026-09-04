export function TerminalStep({
  title,
  message,
  onRestart,
}: {
  title: string;
  message: string;
  onRestart: () => void;
}) {
  return (
    <div className="flow-step">
      <h2>{title}</h2>
      <p>{message}</p>
      <button type="button" className="cta-button" onClick={onRestart}>
        Start Over
      </button>
    </div>
  );
}
