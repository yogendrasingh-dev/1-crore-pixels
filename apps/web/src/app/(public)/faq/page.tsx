const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is 1 Crore Pixels?",
    answer:
      "A public pixel wall where every ₹1 you contribute claims exactly 1 pixel, toward a public goal of ₹1 crore. It's an experiment in raising a business fund one small, voluntary contribution at a time — not an investment or a charity.",
  },
  {
    question: "Is this an investment? Will I get any returns?",
    answer:
      "No. This is a voluntary contribution with no promised or implied financial return, equity, or ownership of any kind. You're supporting the idea, not buying a stake in it.",
  },
  {
    question: "Do I need to create an account?",
    answer:
      "No signup or login is required. Just pick a display name (or stay Anonymous), choose an amount, and pay via UPI.",
  },
  {
    question: "How does ₹1 = 1 pixel work?",
    answer:
      "Your contribution amount in rupees is the exact number of pixels you receive — ₹101 gets you 101 pixels, allocated together as one block on the wall.",
  },
  {
    question: "How do I pay, and how is my payment verified?",
    answer:
      "Payment is via UPI — scan the QR code shown at checkout. After paying, you enter the last 4 digits of your transaction reference as a signal to help our team match your payment. Pixels are only granted after this is verified on our end, not just because the app thinks the payment went through.",
  },
  {
    question: "How long does verification take?",
    answer:
      "Usually quick, but it's a manual check against our payment records, so it can take a little while. You can safely close the page and check back later — your progress is saved.",
  },
  {
    question: "Can I stay anonymous?",
    answer:
      "Yes. Choose \"Show me as Anonymous\" and your real name is never shown publicly, on the pixel wall, or anywhere else — only \"Anonymous\" appears.",
  },
  {
    question: "What if my payment can't be matched or verified?",
    answer:
      "We never guess — if the details don't clearly match, we keep it under review rather than approving or rejecting on partial evidence. If it can't be verified, you'll see that on the page and you can reach out to us via the Contact page.",
  },
  {
    question: "What happens if I want a refund?",
    answer:
      "Reach out via the Contact page and our team will look into it individually. There isn't a self-service refund flow on the site today.",
  },
  {
    question: "What happens once ₹1 crore is raised?",
    answer:
      "The wall doesn't close or reset — it keeps growing for as long as people keep contributing. There's no cap on pixels or contributions.",
  },
  {
    question: "What information do you collect from me?",
    answer:
      "Just a display name (optional/can be Anonymous) and your contribution amount. We never ask for or store your phone number, email, or UPI ID.",
  },
];

export default function FaqPage() {
  return (
    <main>
      <h1>FAQ</h1>
      <p>Answers to the questions we get asked most.</p>
      <div className="faq-list">
        {FAQS.map((faq) => (
          <details key={faq.question} className="faq-item">
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
