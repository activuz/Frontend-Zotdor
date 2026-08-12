import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../api/hooks/useCategories';
import { useCreateListing } from '../api/hooks/useListings';
import { CategoryId } from '../types';
import { Camera, ShieldCheck, ArrowRight } from 'lucide-react';

export const AddListingPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const createListingMutation = useCreateListing();

  const [direction, setDirection] = useState<CategoryId>('gosht');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState<string>('Buqa');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [region, setRegion] = useState('Toshkent viloyati');
  const [description, setDescription] = useState('');
  const [hasPedigree, setHasPedigree] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price) {
      alert("Iltimos, sarlavha va narxni kiriting!");
      return;
    }

    const selectedCatObj = categories.find((c) => c.id === direction);

    createListingMutation.mutate({
      title,
      price: Number(price),
      isNegotiable: true,
      images: [
        '/image0.webp',
        'https://images.unsplash.com/photo-1546445317-29f4545f9d52?auto=format&fit=crop&w=800&q=80',
      ],
      attributes: {
        direction,
        directionLabel: `${selectedCatObj?.icon || '🐾'} ${selectedCatObj?.name || 'Yo\'nalish'}`,
        breed: breed || 'Toza zot',
        gender: gender as any,
        age: age || '2 yosh',
        weight: weight ? `${weight} kg` : '800 kg',
        pedigree: hasPedigree,
      },
      description: description || 'Zotdor platformasida joylashtirilgan chorva moli.',
      location: {
        region,
        city: 'Tuman markazi',
      },
    }, {
      onSuccess: () => {
        alert("E'loningiz muvaffaqiyatli joylashtirildi!");
        navigate('/');
      }
    });
  };

  return (
    <div className="px-4 py-3 max-w-xl mx-auto space-y-4">
      <div className="bg-white p-4 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-1">
        <h1 className="text-xl font-extrabold text-[#1e3a0f] font-display">
          Yangi E'lon Qo'shish
        </h1>
        <p className="text-xs text-[#6b8f4e]">
          Zotdor chorvangizni tez va qulay soting
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category Direction Selection (MUHIM Business requirement) */}
        <div className="bg-white p-4 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-2">
          <label className="text-xs font-bold text-[#1e3a0f] block font-display">
            Chorva Yo'nalishi (Kategoriya) *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => {
              const isSelected = direction === cat.id;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setDirection(cat.id)}
                  className={`p-3 rounded-2xl border text-left flex items-center space-x-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1e3a0f] text-[#eef2dc] border-[#1e3a0f] shadow-md font-bold'
                      : 'bg-white text-[#1e3a0f] border-[#c5d4a8] hover:border-[#3d6b2e]'
                  }`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs block leading-tight truncate">{cat.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Media Upload Area */}
        <div className="bg-white p-4 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-2">
          <label className="text-xs font-bold text-[#1e3a0f] block font-display">
            Chorva rasmlari
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div className="aspect-square rounded-2xl bg-[#dce8c8]/50 border-2 border-dashed border-[#3d6b2e] flex flex-col items-center justify-center text-[#1e3a0f] hover:bg-[#dce8c8] transition-colors cursor-pointer p-2 text-center">
              <Camera className="w-6 h-6 mb-1 text-[#3d6b2e]" />
              <span className="text-[10px] font-bold">Rasm yuklash</span>
            </div>
            <div className="aspect-square rounded-2xl bg-[#f5f8eb] border border-[#c5d4a8] overflow-hidden relative">
              <img src="/image0.webp" alt="Preview 1" className="w-full h-full object-cover" />
              <span className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">Asosiy</span>
            </div>
            <div className="aspect-square rounded-2xl bg-[#f5f8eb] border border-[#c5d4a8] overflow-hidden">
              <img src="/image3.webp" alt="Preview 2" className="w-full h-full object-cover opacity-80" />
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white p-4 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-3">
          <div>
            <label className="text-xs font-bold text-[#1e3a0f] block mb-1">
              E'lon sarlavhasi *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Semental zotli bo'rdoqi buqa"
              className="w-full p-3 bg-[#f5f8eb] rounded-xl border border-[#c5d4a8] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3d6b2e]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#1e3a0f] block mb-1">
                Narxi (UZS) *
              </label>
              <input
                type="number"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="25000000"
                className="w-full p-3 bg-[#f5f8eb] rounded-xl border border-[#c5d4a8] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3d6b2e]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1e3a0f] block mb-1">
                Zoti (Zot nomi)
              </label>
              <input
                type="text"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="Semental, Hisor, Golshtin..."
                className="w-full p-3 bg-[#f5f8eb] rounded-xl border border-[#c5d4a8] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3d6b2e]"
              />
            </div>
          </div>
        </div>

        {/* Attributes Specs */}
        <div className="bg-white p-4 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-3">
          <h4 className="text-xs font-extrabold text-[#3d6b2e] uppercase tracking-wider font-display">
            Xususiyatlar (Wireframe Specs)
          </h4>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-[#6b8f4e] block mb-1">Jinsi</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full p-2 bg-[#f5f8eb] rounded-xl border border-[#c5d4a8] text-xs font-bold"
              >
                <option value="Buqa">Buqa</option>
                <option value="Sigir">Sigir</option>
                <option value="Qo'chqor">Qo'chqor</option>
                <option value="Taka">Taka</option>
                <option value="Baytal">Baytal</option>
                <option value="Erkak">Erkak</option>
                <option value="Urg'och">Urg'och</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#6b8f4e] block mb-1">Yoshi</label>
              <input
                type="text"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="3 yosh"
                className="w-full p-2 bg-[#f5f8eb] rounded-xl border border-[#c5d4a8] text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#6b8f4e] block mb-1">Vazni (kg)</label>
              <input
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="850"
                className="w-full p-2 bg-[#f5f8eb] rounded-xl border border-[#c5d4a8] text-xs font-bold"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-[#eef2dc]">
            <span className="text-xs font-bold text-[#1e3a0f] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#3d6b2e]" />
              Zotdorlik (Pedigree) sertifikati bor
            </span>
            <input
              type="checkbox"
              checked={hasPedigree}
              onChange={(e) => setHasPedigree(e.target.checked)}
              className="w-5 h-5 accent-[#3d6b2e] rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Location & Description */}
        <div className="bg-white p-4 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-3">
          <div>
            <label className="text-xs font-bold text-[#1e3a0f] block mb-1">
              Viloyat / Joylashuv
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full p-3 bg-[#f5f8eb] rounded-xl border border-[#c5d4a8] text-xs font-bold"
            >
              <option value="Toshkent viloyati">Toshkent viloyati</option>
              <option value="Samarqand viloyati">Samarqand viloyati</option>
              <option value="Farg'ona viloyati">Farg'ona viloyati</option>
              <option value="Andijon viloyati">Andijon viloyati</option>
              <option value="Qashqadaryo viloyati">Qashqadaryo viloyati</option>
              <option value="Buxoro viloyati">Buxoro viloyati</option>
              <option value="Xorazm viloyati">Xorazm viloyati</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#1e3a0f] block mb-1">
              Tavsif (Batafsil ma'lumot)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Chorvaning emlanishi, yeyish-ichishi va boshqa xususiyatlari..."
              className="w-full p-3 bg-[#f5f8eb] rounded-xl border border-[#c5d4a8] text-xs font-medium focus:outline-none"
            />
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={createListingMutation.isPending}
          className="w-full bg-[#1e3a0f] hover:bg-[#2d5a20] text-[#eef2dc] font-extrabold py-4 px-6 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm cursor-pointer"
        >
          <span>E'lonni e'lon qilish</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
