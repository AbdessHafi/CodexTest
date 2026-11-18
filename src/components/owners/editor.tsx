/* eslint-disable @next/next/no-img-element -- Same-origin images are served without persistent caching. */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "./forms";
import { allTags, venueTypes } from "@/lib/demo";
import type { ownerDashboard } from "@/lib/owners/service";
type Data = Awaited<ReturnType<typeof ownerDashboard>>;
const days = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
function ActionForm({
  url,
  build,
  children,
  reset = false,
  label,
}: {
  url: string;
  build: (form: FormData) => unknown;
  children: React.ReactNode;
  reset?: boolean;
  label: string;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      aria-label={label}
      className="owner-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        try {
          await post(url, JSON.stringify(build(new FormData(form))), true);
          setMessage("Modifications enregistrées.");
          if (reset) form.reset();
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Opération impossible.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <button className="primary" disabled={busy}>
        Enregistrer
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
function MenuFields({ item }: { item?: Data["menu"][number] }) {
  return (
    <>
      <label>
        Nom du produit
        <input
          name="name"
          defaultValue={item?.name}
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <label>
        Description du produit
        <textarea
          name="description"
          defaultValue={item?.description}
          maxLength={1000}
        />
      </label>
      <label>
        Prix en euros
        <input
          name="price"
          type="number"
          min="0"
          max="10000"
          step="0.01"
          defaultValue={item ? item.price / 100 : undefined}
          required
        />
      </label>
      <label>
        Tags du produit (séparés par des virgules)
        <input
          name="tags"
          defaultValue={item?.tags.join(", ")}
          maxLength={400}
        />
      </label>
      <label>
        Date du plat du jour (facultatif)
        <input
          name="specialDate"
          type="date"
          defaultValue={item?.specialDate || ""}
        />
      </label>
    </>
  );
}
function menuData(f: FormData) {
  return {
    name: String(f.get("name")),
    description: String(f.get("description")),
    price: Math.round(Number(f.get("price")) * 100),
    tags: String(f.get("tags"))
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    specialDate: f.get("specialDate") || null,
  };
}
export default function OwnerEditor({ data }: { data: Data }) {
  const url = `/api/owner/venues/${data.venue.id}`;
  const router = useRouter();
  const [photoMessage, setPhotoMessage] = useState(""),
    [photoBusy, setPhotoBusy] = useState(false);
  const [exceptions, setExceptions] = useState(
    data.exceptions.map((e) => ({
      date: e.date,
      closed: e.closed,
      open: e.open || "09:00",
      close: e.close || "17:00",
    })),
  );
  const v = data.venue;
  return (
    <div className="owner-editor">
      <section>
        <h2>Votre fiche</h2>
        <p>
          Les modifications sont publiques dès leur enregistrement. Le SIRET et
          la propriété restent réservés à l’administration.
        </p>
        <ActionForm
          url={url}
          label="Modifier la fiche"
          build={(f) => ({
            action: "profile",
            data: {
              name: f.get("name"),
              description: f.get("description"),
              address: f.get("address"),
              city: f.get("city"),
              neighborhood: f.get("neighborhood"),
              latitude: Number(f.get("latitude")),
              longitude: Number(f.get("longitude")),
              type: f.get("type"),
              price: Number(f.get("price")),
              tags: f.getAll("tags"),
            },
          })}
        >
          <div className="owner-fields">
            <label>
              Nom de l’établissement
              <input
                name="name"
                defaultValue={v.name}
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label>
              Type
              <select
                name="type"
                defaultValue={v.type}
                aria-label="Type de l’établissement"
              >
                {venueTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Budget
              <select name="price" defaultValue={v.price} aria-label="Budget">
                {[1, 2, 3].map((p) => (
                  <option key={p} value={p}>
                    {"€".repeat(p)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Adresse
              <input
                name="address"
                defaultValue={v.address}
                required
                maxLength={200}
              />
            </label>
            <label>
              Ville
              <input
                name="city"
                defaultValue={v.city}
                required
                maxLength={100}
              />
            </label>
            <label>
              Quartier
              <input
                name="neighborhood"
                defaultValue={v.neighborhood}
                maxLength={100}
              />
            </label>
            <label>
              Latitude
              <input
                name="latitude"
                type="number"
                min="-90"
                max="90"
                step="any"
                defaultValue={v.latitude}
                required
              />
            </label>
            <label>
              Longitude
              <input
                name="longitude"
                type="number"
                min="-180"
                max="180"
                step="any"
                defaultValue={v.longitude}
                required
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              defaultValue={v.description}
              required
              minLength={20}
              maxLength={3000}
            />
          </label>
          <fieldset>
            <legend>Préférences et équipements</legend>
            <div className="owner-fields">
              {allTags.map((t) => (
                <label className="check-label" key={t}>
                  <input
                    type="checkbox"
                    name="tags"
                    value={t}
                    defaultChecked={v.tags.includes(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </section>
      <section>
        <h2>Horaires et exceptions</h2>
        <p>
          Heure de Paris ; un créneau par jour, sans passage de minuit. Un jour
          non coché est fermé.
        </p>
        <ActionForm
          url={url}
          label="Modifier les horaires"
          build={(f) => ({
            action: "schedule",
            data: {
              hours: days.flatMap((_, day) =>
                f.has(`day-${day}`)
                  ? [
                      {
                        day,
                        open: f.get(`open-${day}`),
                        close: f.get(`close-${day}`),
                      },
                    ]
                  : [],
              ),
              exceptions,
            },
          })}
        >
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const h = data.hours.find((h) => h.day === day);
            return (
              <div className="hours-edit" key={day}>
                <label className="check-label">
                  <input
                    type="checkbox"
                    name={`day-${day}`}
                    defaultChecked={!!h}
                  />
                  {days[day]}
                </label>
                <label>
                  Ouverture {days[day]}
                  <input
                    type="time"
                    name={`open-${day}`}
                    defaultValue={h?.open || "09:00"}
                    required
                  />
                </label>
                <label>
                  Fermeture {days[day]}
                  <input
                    type="time"
                    name={`close-${day}`}
                    defaultValue={h?.close || "18:00"}
                    required
                  />
                </label>
              </div>
            );
          })}
          <h3>Ouvertures et fermetures exceptionnelles</h3>
          {exceptions.map((e, i) => (
            <div className="exception-edit" key={i}>
              <label>
                Date d’exception
                <input
                  type="date"
                  value={e.date}
                  required
                  onChange={(ev) =>
                    setExceptions((xs) =>
                      xs.map((x, j) =>
                        j === i ? { ...x, date: ev.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={e.closed}
                  onChange={(ev) =>
                    setExceptions((xs) =>
                      xs.map((x, j) =>
                        j === i ? { ...x, closed: ev.target.checked } : x,
                      ),
                    )
                  }
                />
                Fermé ce jour
              </label>
              {!e.closed && (
                <>
                  <label>
                    Ouverture exceptionnelle
                    <input
                      type="time"
                      value={e.open}
                      onChange={(ev) =>
                        setExceptions((xs) =>
                          xs.map((x, j) =>
                            j === i ? { ...x, open: ev.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Fermeture exceptionnelle
                    <input
                      type="time"
                      value={e.close}
                      onChange={(ev) =>
                        setExceptions((xs) =>
                          xs.map((x, j) =>
                            j === i ? { ...x, close: ev.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                </>
              )}
              <button
                type="button"
                onClick={() =>
                  setExceptions((xs) => xs.filter((_, j) => j !== i))
                }
              >
                Retirer cette exception
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={exceptions.length >= 60}
            onClick={() =>
              setExceptions((xs) => [
                ...xs,
                { date: "", closed: true, open: "09:00", close: "17:00" },
              ])
            }
          >
            + Ajouter une exception
          </button>
        </ActionForm>
      </section>
      <section>
        <h2>Carte et plats du jour</h2>
        <p>
          Les prix sont enregistrés en centimes. Un plat du jour est affiché
          uniquement à la date choisie, en heure de Paris.
        </p>
        <details>
          <summary>Ajouter un produit</summary>
          <ActionForm
            url={url}
            reset
            label="Ajouter un produit"
            build={(f) => ({ action: "menu-create", data: menuData(f) })}
          >
            <MenuFields />
          </ActionForm>
        </details>
        {data.menu.map((item) => (
          <details key={item.id} className="menu-edit">
            <summary>
              {item.name} · {(item.price / 100).toFixed(2)} €
              {item.specialDate ? ` · ${item.specialDate}` : ""}
            </summary>
            <ActionForm
              url={url}
              label={`Modifier ${item.name}`}
              build={(f) => ({
                action: "menu-update",
                itemId: item.id,
                data: menuData(f),
              })}
            >
              <MenuFields item={item} />
            </ActionForm>
            <ActionForm
              url={url}
              label={`Supprimer ${item.name}`}
              build={() => ({ action: "menu-delete", itemId: item.id })}
            >
              <p>Supprimer ce produit et ses photos associées ?</p>
            </ActionForm>
          </details>
        ))}
      </section>
      <section>
        <h2>Photos de la fiche et des produits</h2>
        <p>
          20 images maximum. JPEG, PNG ou WebP, 5 Mo maximum ; publiées
          immédiatement. Ne joignez jamais un justificatif privé ici.
        </p>
        <form
          className="owner-form"
          aria-label="Ajouter une photo"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setPhotoBusy(true);
            try {
              await post(url, new FormData(form));
              setPhotoMessage("Photo publiée.");
              form.reset();
              router.refresh();
            } catch (e) {
              setPhotoMessage(
                e instanceof Error ? e.message : "Envoi impossible.",
              );
            } finally {
              setPhotoBusy(false);
            }
          }}
        >
          <label>
            Photo
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <label>
            Légende de la photo
            <input name="alt" required minLength={5} maxLength={200} />
          </label>
          <label>
            Associer à un produit
            <select name="menuItemId" aria-label="Associer à un produit">
              <option value="">Galerie de l’établissement</option>
              {data.menu.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={photoBusy}>
            Publier la photo
          </button>
          <p role="status">{photoMessage}</p>
        </form>
        <div className="owner-gallery">
          {data.images.map((p) => (
            <div key={p.id}>
              <img
                src={`/api/venues/${v.id}/photos/${p.id}`}
                alt={p.alt}
                width={180}
                height={135}
              />
              <p>{p.alt}</p>
              <ActionForm
                url={url}
                label={`Retirer ${p.alt}`}
                build={() => ({ action: "photo-delete", photoId: p.id })}
              >
                <p>Retirer cette photo publique ?</p>
              </ActionForm>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
