import { illustrationSchema, type Palette } from '@/shared/api'
import { container, cx, heading, Illustration, paletteClass } from '@/shared/ui/portal'

const NAMES = illustrationSchema.options
const PALETTES: Palette[] = ['blue', 'green', 'red', 'purple', 'dark']
const SMALL_SIZES = [34, 48]

/** Review sheet for the illustration set: every icon, palette and small size on one page. */
export function IllustrationsPage() {
  return (
    <div className={cx(container, 'flex flex-col gap-8')}>
      <header>
        <h1 className={heading.h1}>Иллюстрации</h1>
        <p className="text-secondary">{NAMES.length} шт. в стиле объёмных рендеров Авито</p>
      </header>

      <section aria-label="Все иллюстрации" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {NAMES.map((name) => (
          <figure key={name} className="m-0 flex flex-col items-center gap-2 rounded-3xl bg-fill px-3 pt-5 pb-3">
            <Illustration name={name} size={110} />
            <figcaption className="text-13 text-secondary">{name}</figcaption>
          </figure>
        ))}
      </section>

      <section aria-label="На палитрах" className="flex flex-col gap-3">
        <h2 className={heading.h2}>На палитрах</h2>
        {PALETTES.map((palette) => (
          <div
            key={palette}
            className={cx(paletteClass[palette], 'flex flex-wrap gap-4 rounded-3xl bg-tone-soft p-4')}
          >
            {NAMES.map((name) => (
              <Illustration key={name} name={name} size={72} />
            ))}
          </div>
        ))}
      </section>

      <section aria-label="Мелкие размеры" className="flex flex-col gap-3">
        <h2 className={heading.h2}>Мелкие размеры</h2>
        {SMALL_SIZES.map((size) => (
          <div key={size} className="flex flex-wrap items-center gap-4">
            <span className="w-12 text-13 text-secondary">{size} px</span>
            {NAMES.map((name) => (
              <span
                key={name}
                className="inline-flex items-center justify-center rounded-[30%] bg-control"
                style={{ width: Math.round(size * 1.4), height: Math.round(size * 1.4) }}
              >
                <Illustration name={name} size={size} />
              </span>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}
