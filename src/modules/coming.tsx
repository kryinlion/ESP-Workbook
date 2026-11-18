import type { ModuleDef } from './registry';

export function ComingSoon({ m }: { m: ModuleDef }) {
  return (
    <div class="page">
      <div class="card hero-soon">
        <div class="big-ico">{m.icon}</div>
        <h1>{m.title}</h1>
        <p>{m.blurb}</p>
        <span class="pill">Coming in build phase {m.phase}</span>
      </div>
      <div class="card">
        <h3>What it will do</h3>
        <ul class="feat">{m.features?.map((f) => <li>{f}</li>)}</ul>
      </div>
    </div>
  );
}
