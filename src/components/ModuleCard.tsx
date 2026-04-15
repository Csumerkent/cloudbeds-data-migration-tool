import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icons';

interface CardAction {
  label: string;
  tone?: 'primary' | 'secondary';
  onClick?: () => void;
}

interface ModuleCardProps {
  icon: IconName;
  title: string;
  description: string;
  badge?: string;
  footer?: ReactNode;
  stats?: Array<{ label: string; value: string }>;
  actions?: CardAction[];
}

function ModuleCard({ icon, title, description, badge, footer, stats, actions }: ModuleCardProps) {
  return (
    <article className="module-card">
      <div className="module-card__header">
        <div className="module-card__title-wrap">
          <span className="module-card__icon">
            <Icon name={icon} size={20} />
          </span>
          <div>
            <div className="module-card__title-row">
              <h3>{title}</h3>
              {badge ? <span className="module-card__badge">{badge}</span> : null}
            </div>
            <p>{description}</p>
          </div>
        </div>
      </div>

      {stats && stats.length > 0 ? (
        <dl className="module-card__stats">
          {stats.map((stat) => (
            <div key={stat.label} className="module-card__stat">
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {footer ? <div className="module-card__footer">{footer}</div> : null}

      {actions && actions.length > 0 ? (
        <div className="module-card__actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`btn ${action.tone === 'secondary' ? 'btn-secondary' : 'btn-primary'}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default ModuleCard;
