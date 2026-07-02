/**
 * File purpose: Defines the reusable Skeleton React component and its focused user interaction.
 */
// Skeleton placeholders make loading states intentional instead of jumpy.
/**
 * Renders the skeleton React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Skeleton({ rows = 3 }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" style={{ width: `${92 - index * 9}%`, height: index === 0 ? 24 : 16 }} />
      ))}
    </div>
  );
}
