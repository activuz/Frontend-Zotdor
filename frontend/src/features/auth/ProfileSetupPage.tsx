import React, { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/http';
import { useMe, useRegions, useUpdateProfile } from './api';
import { safeNext } from './next';
import { PageError, PageLoading } from '../../components/ui/PageState';

const fieldClass =
  'w-full min-h-touch px-3 rounded-xl border border-line bg-surface text-[16px] text-ink focus:outline-none focus:ring-2 focus:ring-brand';

/** First-login profile (FR-02): name and location are needed for distance and display. */
export const ProfileSetupPage: React.FC = () => {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { data: me, isPending } = useMe();

  if (isPending) return <PageLoading />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  return (
    <ProfileForm
      next={next}
      initial={{
        firstName: me.first_name ?? '',
        lastName: me.last_name ?? '',
        regionId: me.region?.id ?? '',
        districtId: me.district?.id ?? '',
      }}
    />
  );
};

interface FormValues {
  firstName: string;
  lastName: string;
  regionId: number | '';
  districtId: number | '';
}

const ProfileForm: React.FC<{ next: string; initial: FormValues }> = ({ next, initial }) => {
  const navigate = useNavigate();
  const regions = useRegions();
  const update = useUpdateProfile();
  const [values, setValues] = useState<FormValues>(initial);

  if (regions.isPending) return <PageLoading />;
  if (regions.isError) return <PageError message={regions.error.message} onRetry={() => void regions.refetch()} />;

  const districts = regions.data.find((r) => r.id === values.regionId)?.districts ?? [];
  const fieldErrors = update.error instanceof ApiError ? update.error.fields : undefined;
  const complete = values.firstName.trim() !== '' && values.regionId !== '' && values.districtId !== '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (values.regionId === '' || values.districtId === '') return;
    update.mutate(
      {
        first_name: values.firstName,
        last_name: values.lastName,
        region_id: values.regionId,
        district_id: values.districtId,
      },
      { onSuccess: () => navigate(next, { replace: true }) },
    );
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <h1 className="font-display text-[28px] leading-tight text-ink">Profilingiz</h1>
      <p className="mt-2 text-[15px] text-ink-muted">
        Ism xaridor va sotuvchiga koʻrinadi. Tuman yaqin auksionlarni topish uchun kerak — aniq manzilingiz hech
        kimga koʻrsatilmaydi.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="first-name" className="block mb-1 text-[15px] font-semibold text-ink">
            Ism
          </label>
          <input
            id="first-name"
            required
            maxLength={64}
            autoComplete="given-name"
            value={values.firstName}
            onChange={(e) => setValues({ ...values, firstName: e.target.value })}
            className={fieldClass}
          />
          {fieldErrors?.first_name && <p className="mt-1 text-[14px] text-danger">{fieldErrors.first_name[0]}</p>}
        </div>
        <div>
          <label htmlFor="last-name" className="block mb-1 text-[15px] font-semibold text-ink">
            Familiya <span className="font-normal text-ink-muted">(ixtiyoriy)</span>
          </label>
          <input
            id="last-name"
            maxLength={64}
            autoComplete="family-name"
            value={values.lastName}
            onChange={(e) => setValues({ ...values, lastName: e.target.value })}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="region" className="block mb-1 text-[15px] font-semibold text-ink">
            Viloyat
          </label>
          <select
            id="region"
            required
            value={values.regionId}
            onChange={(e) =>
              setValues({ ...values, regionId: e.target.value ? Number(e.target.value) : '', districtId: '' })
            }
            className={fieldClass}
          >
            <option value="">Tanlang</option>
            {regions.data.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="district" className="block mb-1 text-[15px] font-semibold text-ink">
            Tuman yoki shahar
          </label>
          <select
            id="district"
            required
            disabled={values.regionId === ''}
            value={values.districtId}
            onChange={(e) => setValues({ ...values, districtId: e.target.value ? Number(e.target.value) : '' })}
            className={`${fieldClass} disabled:opacity-50`}
          >
            <option value="">{values.regionId === '' ? 'Avval viloyatni tanlang' : 'Tanlang'}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {fieldErrors?.district_id && (
            <p className="mt-1 text-[14px] text-danger">{fieldErrors.district_id[0]}</p>
          )}
        </div>

        {update.isError && !fieldErrors && (
          <p role="alert" className="text-[15px] text-danger">
            {update.error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={update.isPending || !complete}
          className="w-full min-h-touch rounded-xl bg-ink text-page text-[16px] font-bold disabled:opacity-50"
        >
          {update.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
      </form>
    </div>
  );
};
