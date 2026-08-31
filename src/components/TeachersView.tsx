import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Plus, Trash2, User, Camera, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Teacher } from '@/types';
import StateBlock from '@/components/StateBlock';

type MyProfile = {
  teacher_id: string;
  display_name: string;
  is_admin: boolean;
  must_change_password: boolean;
};

type Props = {
  editMode: boolean;
  onOpen: (t: Teacher) => void;
  isAdmin?: boolean;
  myProfile?: MyProfile | null;
};

export default function TeachersView({
  editMode,
  onOpen,
  isAdmin,
  myProfile,
}: Props) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [myTeacherId, setMyTeacherId] = useState<string | null>(null);
  const [myTeacherIdLoaded, setMyTeacherIdLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from('teachers')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (loadError) {
      console.error('Ошибка загрузки преподавателей:', loadError);
      setError(loadError.message);
      setTeachers([]);
    } else {
      console.log('Ответ Supabase teachers:', data);

      const validTeachers = (data ?? []).filter(
        (teacher): teacher is Teacher =>
          teacher !== null &&
          teacher !== undefined &&
          typeof teacher === 'object' &&
          typeof teacher.id === 'string'
      );

      setTeachers(validTeachers);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!myProfile || isAdmin) {
      setMyTeacherId(null);
      setMyTeacherIdLoaded(true);
      return;
    }

    setMyTeacherIdLoaded(false);

    supabase
      .rpc('get_my_teacher_id')
      .then(({ data, error: rpcError }) => {
        if (rpcError) {
          console.error('Ошибка get_my_teacher_id:', rpcError);
          setMyTeacherId(null);
          return;
        }

        setMyTeacherId(typeof data === 'string' ? data : null);
      })
      .finally(() => {
        setMyTeacherIdLoaded(true);
      });
  }, [myProfile, isAdmin]);

  const canEditTeacher = (teacher: Teacher) => {
    if (!editMode) return false;
    if (isAdmin) return true;

    return teacher.id === myTeacherId;
  };

  const canAddTeacher = () => {
    return editMode && Boolean(isAdmin);
  };

  const canCreateOwnSection = () => {
    if (!editMode || isAdmin) return false;

    return myTeacherId === null && Boolean(myProfile);
  };

  const createOwnSection = async () => {
    const name = newName.trim();

    if (!name || saving || !canCreateOwnSection() || !myProfile) {
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('teachers')
      .insert({
        name,
        owner_id: myProfile.teacher_id,
        sort_order: teachers.length,
      })
      .select()
      .maybeSingle();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (!data?.id) {
      setError('Не удалось создать раздел преподавателя.');
      return;
    }

    setTeachers((prev) => [...prev, data]);
    setMyTeacherId(data.id);
    setNewName('');
  };

  const addTeacher = async () => {
    const name = newName.trim();

    if (!name || saving || !canAddTeacher()) {
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('teachers')
      .insert({
        name,
        sort_order: teachers.length,
      })
      .select()
      .maybeSingle();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (!data?.id) {
      setError('Не удалось добавить преподавателя.');
      return;
    }

    setTeachers((prev) => [...prev, data]);
    setNewName('');
  };

  const rename = async (teacher: Teacher, name: string) => {
    setTeachers((prev) =>
      prev.map((item) =>
        item.id === teacher.id ? { ...item, name } : item
      )
    );

    const { error: updateError } = await supabase
      .from('teachers')
      .update({ name })
      .eq('id', teacher.id);

    if (updateError) {
      setError(updateError.message);
      await load();
    }
  };

  const remove = async (teacher: Teacher) => {
    const confirmed = confirm(
      `Удалить преподавателя «${teacher.name}» вместе со всеми заданиями?`
    );

    if (!confirmed) {
      return;
    }

    const previousTeachers = teachers;

    setTeachers((prev) =>
      prev.filter((item) => item.id !== teacher.id)
    );

    const { error: deleteError } = await supabase
      .from('teachers')
      .delete()
      .eq('id', teacher.id);

    if (deleteError) {
      setError(deleteError.message);
      setTeachers(previousTeachers);
    }
  };

  const triggerUpload = (teacherId: string) => {
    setUploadFor(teacherId);
    fileRef.current?.click();
  };

  const onFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file || !uploadFor) {
      return;
    }

    setUploadingId(uploadFor);
    setError(null);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${uploadFor}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('teacher-photos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setUploadingId(null);
      event.target.value = '';
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('teacher-photos')
      .getPublicUrl(path);

    const photoUrl = publicUrlData.publicUrl;

    setTeachers((prev) =>
      prev.map((teacher) =>
        teacher.id === uploadFor
          ? { ...teacher, photo_url: photoUrl }
          : teacher
      )
    );

    const { error: updateError } = await supabase
      .from('teachers')
      .update({ photo_url: photoUrl })
      .eq('id', uploadFor);

    if (updateError) {
      setError(updateError.message);
      await load();
    }

    setUploadingId(null);
    setUploadFor(null);
    event.target.value = '';
  };

  const removePhoto = async (teacher: Teacher) => {
    const previousTeachers = teachers;

    setTeachers((prev) =>
      prev.map((item) =>
        item.id === teacher.id
          ? { ...item, photo_url: null }
          : item
      )
    );

    const { error: updateError } = await supabase
      .from('teachers')
      .update({ photo_url: null })
      .eq('id', teacher.id);

    if (updateError) {
      setError(updateError.message);
      setTeachers(previousTeachers);
    }
  };

  const Avatar = ({
    teacher,
    size,
  }: {
    teacher: Teacher;
    size: 'sm' | 'lg';
  }) => {
    const dim = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';

    if (teacher.photo_url) {
      return (
        <img
          src={teacher.photo_url}
          alt={teacher.name}
          className={`${dim} shrink-0 rounded-full object-cover ring-2 ring-amber-100 dark:ring-amber-900/50`}
        />
      );
    }

    return (
      <span
        className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400`}
      >
        <User size={size === 'lg' ? 22 : 18} />
      </span>
    );
  };

  const safeTeachers = teachers.filter(
    (teacher): teacher is Teacher =>
      teacher !== null &&
      teacher !== undefined &&
      typeof teacher === 'object' &&
      typeof teacher.id === 'string'
  );

  return (
    <section>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="mb-5">
        <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Преподаватели
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Выберите преподавателя, чтобы открыть его расписание и задания.
        </p>
      </div>

      {loading || error ? (
        <StateBlock loading={loading} error={error} />
      ) : safeTeachers.length === 0 && !editMode ? (
        <StateBlock empty emptyText="Список преподавателей пока пуст" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <ul className="divide-y divide-stone-100 dark:divide-slate-700">
            {safeTeachers.map((teacher) => (
              <li key={teacher.id} className="group">
                {canEditTeacher(teacher) ? (
                  <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="relative shrink-0">
                      <Avatar teacher={teacher} size="lg" />

                      {uploadingId === teacher.id && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70 dark:bg-slate-800/70">
                          <Loader2
                            size={18}
                            className="animate-spin text-amber-600"
                          />
                        </span>
                      )}
                    </div>

                    <input
                      defaultValue={teacher.name}
                      onBlur={(event) => {
                        const value = event.target.value.trim();

                        if (value && value !== teacher.name) {
                          rename(teacher, value);
                        }
                      }}
                      className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />

                    <button
                      onClick={() => triggerUpload(teacher.id)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-slate-600"
                      title="Загрузить фото"
                    >
                      <Camera size={18} />
                    </button>

                    {teacher.photo_url && (
                      <button
                        onClick={() => removePhoto(teacher)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                        title="Удалить фото"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => remove(teacher)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                        title="Удалить преподавателя"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ) : editMode && !isAdmin && teacher.id !== myTeacherId ? (
                  <button
                    onClick={() => onOpen(teacher)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-amber-50/60 sm:px-5 dark:hover:bg-slate-700/50"
                  >
                    <Avatar teacher={teacher} size="lg" />
                    <span className="flex-1 text-lg font-medium text-slate-800 dark:text-slate-200">
                      {teacher.name}
                    </span>
                    <Lock
                      size={16}
                      className="text-stone-300 dark:text-slate-600"
                    />
                  </button>
                ) : (
                  <button
                    onClick={() => onOpen(teacher)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-amber-50/60 sm:px-5 dark:hover:bg-slate-700/50"
                  >
                    <Avatar teacher={teacher} size="lg" />
                    <span className="flex-1 text-lg font-medium text-slate-800 dark:text-slate-200">
                      {teacher.name}
                    </span>
                    <ChevronRight
                      size={20}
                      className="text-stone-300 transition-transform group-hover:translate-x-1 group-hover:text-amber-600 dark:text-slate-600 dark:group-hover:text-amber-400"
                    />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {canAddTeacher() && (
            <div className="flex items-center gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3 sm:px-5 dark:border-slate-700 dark:bg-slate-700/50">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    addTeacher();
                  }
                }}
                placeholder="Имя нового преподавателя"
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />

              <button
                onClick={addTeacher}
                disabled={!newName.trim() || saving}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-40"
              >
                <Plus size={16} /> Добавить
              </button>
            </div>
          )}
        </div>
      )}

      {editMode &&
        !isAdmin &&
        myTeacherIdLoaded &&
        myTeacherId === null && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-700 dark:bg-amber-900/30">
            <p className="mb-3 text-sm text-amber-800 dark:text-amber-300">
              У вас пока нет своего раздела преподавателя. Создайте его,
              чтобы добавлять расписание и задания.
            </p>

            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    createOwnSection();
                  }
                }}
                placeholder="Ваше имя для табло"
                className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:border-amber-700 dark:bg-slate-700 dark:text-slate-100"
              />

              <button
                onClick={createOwnSection}
                disabled={!newName.trim() || saving}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-40"
              >
                <Plus size={16} /> Создать раздел
              </button>
            </div>
          </div>
        )}
    </section>
  );
}
