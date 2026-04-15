import type { ReactNode } from 'react';

interface PageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
  meta?: Array<{ label: string; value: string }>;
  actions?: ReactNode;
  children: ReactNode;
}

function PageShell({ eyebrow, title, description, badge, meta, actions, children }: PageShellProps) {
  return (
    <section className="page-shell">
      <div className="page-shell__hero">
        <div className="page-shell__hero-copy">
          <span className="page-shell__eyebrow">{eyebrow}</span>
          <div className="page-shell__headline">
            <h2>{title}</h2>
            {badge ? <span className="page-shell__badge">{badge}</span> : null}
          </div>
          <p>{description}</p>
          {meta && meta.length > 0 ? (
            <dl className="page-shell__meta">
              {meta.map((item) => (
                <div key={item.label} className="page-shell__meta-item">
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {actions ? <div className="page-shell__actions">{actions}</div> : null}
      </div>

      <div className="page-shell__content">{children}</div>
    </section>
  );
}

export default PageShell;
