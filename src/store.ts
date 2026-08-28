/**
 * @module store
 * Reactive state management with localStorage persistence.
 * Supports multiple fiscal years, multi-profile/multi-declarant and Dark/Light theme.
 */

import type { DeclaracionData, UserProfile, UserType, StoreListener, AppTheme, ComplementaryIRPFData } from './types.ts';
import type { IVAData, IVAInvoiceIssued, IVAInvoiceReceived, IVABienInversion, FiscalQuarter, Model303QuarterResult } from './types-iva.ts';
import { FISCAL_YEARS, type FiscalYear } from './fiscal/constants.ts';
import { initializeEmptyIVAData, syncActivitiesToIVA, syncIVAToActivities, syncPropertiesToIVA } from './fiscal/iva-integration.ts';
import { calculateAllQuarters } from './fiscal/iva-engine.ts';
import { getDemoProfilesData } from './fiscal/user-presets.ts';
import { ALL_APP_MODULES, MODULE_PRESETS, getActiveModuleIdsForProfile } from './fiscal/modules-catalog.ts';
import { createEmptyDeclaracion } from './fiscal/declaration-factory.ts';
import { validateAndSanitizeDeclaration } from './fiscal/schema-validator.ts';

export { createEmptyDeclaracion };

const STORAGE_PREFIX = 'hacienda_';

const DEFAULT_PROFILES: UserProfile[] = [
  {
    id: 'profile_main',
    name: 'Declarant Principal',
    type: 'employee',
    relation: 'main',
    status: 'draft',
    avatarColor: '#6366f1',
    avatarIcon: '👤',
    tags: ['Principal'],
    enabledModules: ALL_APP_MODULES.map(m => m.id),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Singleton reactive store.
 */
class Store {
  private data: DeclaracionData;
  private currentYear: FiscalYear;
  private activeProfileId: string;
  private profiles: UserProfile[];
  private currentTheme: AppTheme;
  private listeners = new Set<StoreListener>();
  private keyListeners = new Map<string, Set<(sectionData: unknown) => void>>();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.currentTheme = this.loadTheme();
    this.applyTheme(this.currentTheme);
    this.profiles = this.loadProfiles();
    this.activeProfileId = this.loadActiveProfileId();
    this.currentYear = this.loadCurrentYear();
    this.data = this.load(this.activeProfileId, this.currentYear);

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }


  /** Get current declaration data (read-only snapshot). */
  getData(): DeclaracionData {
    return this.data;
  }

  /** Get current fiscal year. */
  getYear(): FiscalYear {
    return this.currentYear;
  }

  /** Switch to a different fiscal year. */
  setYear(year: FiscalYear): void {
    this.save(true);
    this.currentYear = year;
    this.data = this.load(this.activeProfileId, year);
    localStorage.setItem(`${STORAGE_PREFIX}current_year`, String(year));
    this.notify();
  }

  /* ── Multi-profile Management ────────────────────────────── */

  getProfiles(): UserProfile[] {
    return [...this.profiles];
  }

  getProfile(profileId: string): UserProfile | undefined {
    return this.profiles.find(p => p.id === profileId);
  }

  getActiveProfileId(): string {
    return this.activeProfileId;
  }

  getActiveProfile(): UserProfile {
    return this.profiles.find(p => p.id === this.activeProfileId) || this.profiles[0];
  }

  setActiveProfile(profileId: string): void {
    if (profileId === this.activeProfileId) return;
    this.save(true);
    this.activeProfileId = profileId;
    localStorage.setItem(`${STORAGE_PREFIX}active_profile_id`, profileId);
    this.data = this.load(profileId, this.currentYear);
    this.notify();
  }

  createProfile(
    nameOrOptions: string | (Partial<UserProfile> & { name: string }),
    relation: UserProfile['relation'] = 'other',
  ): UserProfile {
    const opts: Partial<UserProfile> & { name: string } =
      typeof nameOrOptions === 'string'
        ? { name: nameOrOptions, relation }
        : nameOrOptions;

    const profileType: UserType = opts.type || (opts.relation === 'spouse' ? 'family_member' : 'employee');

    const defaultColor = opts.avatarColor || (
      profileType === 'freelance' ? '#10b981' :
      profileType === 'investor' ? '#a855f7' :
      profileType === 'landlord' ? '#f59e0b' :
      profileType === 'retiree' ? '#ec4899' :
      profileType === 'beckham' ? '#eab308' :
      profileType === 'family_member' ? '#f43f5e' :
      profileType === 'advisor_client' ? '#6366f1' : '#3b82f6'
    );

    const defaultIcon = opts.avatarIcon || (
      profileType === 'freelance' ? '🏢' :
      profileType === 'investor' ? '📈' :
      profileType === 'landlord' ? '🏠' :
      profileType === 'retiree' ? '🏖️' :
      profileType === 'beckham' ? '🌍' :
      profileType === 'family_member' ? '👨‍👩‍👧‍👦' :
      profileType === 'advisor_client' ? '📁' : '💼'
    );

    const newProfile: UserProfile = {
      id: `profile_${crypto.randomUUID().substring(0, 8)}`,
      name: opts.name.trim() || 'Nou Declarant',
      type: profileType,
      relation: opts.relation || 'other',
      nif: opts.nif?.trim().toUpperCase() || '',
      email: opts.email?.trim() || '',
      phone: opts.phone?.trim() || '',
      birthDate: opts.birthDate || '',
      community: opts.community || 'CAT',
      status: opts.status || 'draft',
      notes: opts.notes || '',
      avatarColor: defaultColor,
      avatarIcon: defaultIcon,
      tags: Array.isArray(opts.tags) ? opts.tags : [],
      iban: opts.iban?.trim() || '',
      activityIAE: opts.activityIAE?.trim() || '',
      enabledModules: Array.isArray(opts.enabledModules) && opts.enabledModules.length > 0
        ? opts.enabledModules
        : ALL_APP_MODULES.map(m => m.id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles.push(newProfile);
    this.saveProfiles();

    // Initialize declarations for all fiscal years and sync personal details
    for (const year of FISCAL_YEARS) {
      const decl = createEmptyDeclaracion(year, newProfile.id);
      decl.personal.name = newProfile.name;
      decl.personal.nif = newProfile.nif;
      decl.personal.community = newProfile.community || 'CAT';
      localStorage.setItem(`${STORAGE_PREFIX}data_${newProfile.id}_${year}`, JSON.stringify(decl));
    }

    this.setActiveProfile(newProfile.id);
    return newProfile;
  }

  updateProfile(profileId: string, updates: Partial<UserProfile>): UserProfile | undefined {
    const idx = this.profiles.findIndex(p => p.id === profileId);
    if (idx === -1) return undefined;

    const current = this.profiles[idx];
    const updated: UserProfile = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.profiles[idx] = updated;
    this.saveProfiles();

    // Sync active declaration's personal details if updated
    if (profileId === this.activeProfileId) {
      const personalUpdates: Partial<DeclaracionData['personal']> = {};
      if (updates.name !== undefined) personalUpdates.name = updates.name;
      if (updates.nif !== undefined) personalUpdates.nif = updates.nif;
      if (updates.community !== undefined) personalUpdates.community = updates.community;
      if (Object.keys(personalUpdates).length > 0) {
        this.update('personal', personalUpdates);
      }
    }

    this.notify();
    return updated;
  }

  duplicateProfile(profileId: string, newName?: string): UserProfile | undefined {
    const original = this.getProfile(profileId);
    if (!original) return undefined;

    const clonedProfile: UserProfile = {
      ...original,
      id: `profile_${crypto.randomUUID().substring(0, 8)}`,
      name: newName || `${original.name} (Còpia / Escenari)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles.push(clonedProfile);
    this.saveProfiles();

    // Duplicate all fiscal years declarations
    for (const year of FISCAL_YEARS) {
      const origData = this.load(profileId, year);
      const clonedData: DeclaracionData = {
        ...JSON.parse(JSON.stringify(origData)),
        profileId: clonedProfile.id,
      };
      clonedData.personal.name = clonedProfile.name;
      localStorage.setItem(`${STORAGE_PREFIX}data_${clonedProfile.id}_${year}`, JSON.stringify(clonedData));
    }

    this.setActiveProfile(clonedProfile.id);
    return clonedProfile;
  }

  deleteProfile(profileId: string): void {
    if (this.profiles.length <= 1) return; // Must have at least 1

    // Clean up stored declarations
    for (const year of FISCAL_YEARS) {
      localStorage.removeItem(`${STORAGE_PREFIX}data_${profileId}_${year}`);
    }

    this.profiles = this.profiles.filter(p => p.id !== profileId);
    this.saveProfiles();

    if (this.activeProfileId === profileId) {
      this.setActiveProfile(this.profiles[0].id);
    } else {
      this.notify();
    }
  }

  getProfileData(profileId: string, year: FiscalYear = this.currentYear): DeclaracionData {
    return this.load(profileId, year);
  }

  exportSingleProfile(profileId: string): string {
    const profile = this.getProfile(profileId);
    if (!profile) throw new Error('Perfil no trobat');

    const profileData: Record<string, DeclaracionData> = {};
    for (const year of FISCAL_YEARS) {
      profileData[year] = this.load(profileId, year);
    }

    return JSON.stringify({
      version: '2.0',
      exportedAt: new Date().toISOString(),
      profile,
      declarations: profileData,
    }, null, 2);
  }

  importSingleProfile(jsonStr: string): UserProfile {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.profile || !parsed.profile.name) {
        throw new Error('Estructura de fitxer de perfil no vàlida');
      }

      const importedProfile: UserProfile = {
        ...parsed.profile,
        id: `profile_${crypto.randomUUID().substring(0, 8)}`,
        name: parsed.profile.name,
        updatedAt: new Date().toISOString(),
      };

      this.profiles.push(importedProfile);
      this.saveProfiles();

      if (parsed.declarations) {
        for (const [yearStr, dData] of Object.entries(parsed.declarations)) {
          const year = parseInt(yearStr, 10) as FiscalYear;
          if (FISCAL_YEARS.includes(year)) {
            const dataToSave = {
              ...(dData as DeclaracionData),
              profileId: importedProfile.id,
            };
            localStorage.setItem(`${STORAGE_PREFIX}data_${importedProfile.id}_${year}`, JSON.stringify(dataToSave));
          }
        }
      }

      this.setActiveProfile(importedProfile.id);
      return importedProfile;
    } catch (e) {
      console.error('Error importing single profile:', e);
      throw new Error('No s\'ha pogut importar el perfil: format incorrecte');
    }
  }

  loadDemoProfiles(): void {
    const demo = getDemoProfilesData();
    this.profiles = demo.profiles;
    this.saveProfiles();

    for (const [key, dData] of Object.entries(demo.declarations)) {
      localStorage.setItem(`${STORAGE_PREFIX}data_${key}`, JSON.stringify(dData));
    }

    this.setActiveProfile(demo.profiles[0].id);
    this.notify();
  }

  /* ── Modular Tools & Feature Management ────────────────────── */

  /** Obté els IDs de les eines activades per al perfil (o l'actiu per defecte) */
  getEnabledModules(profileId?: string): string[] {
    const targetId = profileId || this.activeProfileId;
    const profile = this.getProfile(targetId);
    return getActiveModuleIdsForProfile(profile);
  }

  /** Comprova si un mòdul està activat */
  isModuleEnabled(moduleId: string, profileId?: string): boolean {
    const enabled = this.getEnabledModules(profileId);
    return enabled.includes(moduleId);
  }

  /** Activa o desactiva un mòdul (toggle) */
  toggleModule(moduleId: string, profileId?: string): boolean {
    const targetId = profileId || this.activeProfileId;
    const profile = this.getProfile(targetId);
    if (!profile) return false;

    const currentModules = getActiveModuleIdsForProfile(profile);
    let newModules: string[];

    if (currentModules.includes(moduleId)) {
      if (currentModules.length <= 1) return true; // Mantenir almenys 1 mòdul
      newModules = currentModules.filter(m => m !== moduleId);
    } else {
      newModules = [...currentModules, moduleId];
    }

    this.updateProfile(targetId, { enabledModules: newModules });
    return newModules.includes(moduleId);
  }

  /** Estableix la llista completa de mòduls per a un perfil */
  setProfileModules(profileId: string, moduleIds: string[]): void {
    this.updateProfile(profileId, { enabledModules: [...moduleIds] });
  }

  /** Activa el 100% de les eines per al perfil */
  enableAllModules(profileId?: string): void {
    const targetId = profileId || this.activeProfileId;
    this.updateProfile(targetId, { enabledModules: ALL_APP_MODULES.map(m => m.id) });
  }

  /** Aplica una plantilla de configuració d'eines (Preset) */
  applyModulePreset(presetId: string, profileId?: string): void {
    const targetId = profileId || this.activeProfileId;
    const preset = MODULE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      this.updateProfile(targetId, { enabledModules: [...preset.moduleIds] });
    }
  }

  /* ── Theme Management ────────────────────────────────────── */

  getTheme(): AppTheme {
    return this.currentTheme;
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme = theme;
    this.applyTheme(theme);
    localStorage.setItem(`${STORAGE_PREFIX}theme`, theme);
    this.notify();
  }

  toggleTheme(): AppTheme {
    const cycle: AppTheme[] = ['dark', 'light', 'emerald', 'nord'];
    const idx = cycle.indexOf(this.currentTheme);
    const next = cycle[(idx + 1) % cycle.length];
    this.setTheme(next);
    return next;
  }

  private applyTheme(theme: AppTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  private loadTheme(): AppTheme {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}theme`) as AppTheme;
      if (stored === 'light' || stored === 'dark' || stored === 'emerald' || stored === 'nord') {
        return stored;
      }
    }
    return 'dark';
  }


  /* ── Data Updates ────────────────────────────────────────── */

  /** Update declaration data (partial merge or array replacement). */
  update<K extends keyof DeclaracionData>(
    section: K,
    value: Partial<DeclaracionData[K]>,
  ): void {
    if (Array.isArray(value) || Array.isArray(this.data[section])) {
      (this.data as unknown as Record<string, unknown>)[section as string] = Array.isArray(value) ? [...value] : value;
    } else {
      (this.data as unknown as Record<string, unknown>)[section as string] = {
        ...(this.data[section] as unknown as Record<string, unknown>),
        ...(value as unknown as Record<string, unknown>),
      };
    }
    this.data = { ...this.data };
    this.save();
    this.notify(section);
  }

  /** Replace an entire section. */
  setSection<K extends keyof DeclaracionData>(
    section: K,
    value: DeclaracionData[K],
  ): void {
    (this.data as unknown as Record<string, unknown>)[section as string] = value;
    this.data = { ...this.data };
    this.save();
    this.notify(section);
  }

  /** Subscribe to all global changes. Returns unsubscribe function. */
  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Subscribe to a specific declaration section for optimized granular updates. */
  subscribeKey<K extends keyof DeclaracionData>(
    key: K,
    listener: (sectionData: DeclaracionData[K]) => void,
  ): () => void {
    const keyStr = key as string;
    if (!this.keyListeners.has(keyStr)) {
      this.keyListeners.set(keyStr, new Set());
    }
    const set = this.keyListeners.get(keyStr)!;
    const genericListener = listener as (sectionData: unknown) => void;
    set.add(genericListener);
    return () => {
      set.delete(genericListener);
      if (set.size === 0) this.keyListeners.delete(keyStr);
    };
  }

  /** Clear all data for current profile and year. */
  reset(): void {
    this.data = createEmptyDeclaracion(this.currentYear, this.activeProfileId);
    this.save(true);
    this.notify();
  }

  /**
   * Purge absolutely all stored data, resetting profiles to the initial clean state
   * and clearing all stored records from localStorage.
   */
  clearAllApplicationData(): void {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }

    this.profiles = JSON.parse(JSON.stringify(DEFAULT_PROFILES));
    this.activeProfileId = this.profiles[0].id;
    this.currentYear = FISCAL_YEARS[FISCAL_YEARS.length - 1];
    this.data = createEmptyDeclaracion(this.currentYear, this.activeProfileId);
    this.saveProfiles();
    this.save(true);
    this.notify();
  }

  /** Export all profiles & years data as JSON string. */
  exportAll(): string {
    const exportObj = {
      profiles: this.profiles,
      activeProfileId: this.activeProfileId,
      currentYear: this.currentYear,
      theme: this.currentTheme,
      data: {} as Record<string, DeclaracionData>,
    };

    for (const p of this.profiles) {
      for (const year of FISCAL_YEARS) {
        const key = `${p.id}_${year}`;
        exportObj.data[key] = this.load(p.id, year);
      }
    }

    return JSON.stringify(exportObj, null, 2);
  }

  /** Import data from JSON string. */
  importData(json: string): void {
    try {
      const parsed = JSON.parse(json);
      if (parsed.profiles && Array.isArray(parsed.profiles)) {
        this.profiles = parsed.profiles;
        this.saveProfiles();
        if (parsed.data) {
          for (const [k, d] of Object.entries(parsed.data)) {
            localStorage.setItem(`${STORAGE_PREFIX}data_${k}`, JSON.stringify(d));
          }
        }
      } else {
        // Legacy single-profile format
        for (const [yearStr, yearData] of Object.entries(parsed)) {
          const key = `${STORAGE_PREFIX}data_${this.activeProfileId}_${yearStr}`;
          localStorage.setItem(key, JSON.stringify(yearData));
        }
      }
      this.data = this.load(this.activeProfileId, this.currentYear);
      this.notify();
    } catch (e) {
      console.error('Failed to import data:', e);
      throw new Error('Format de dades invàlid');
    }
  }

  /** Flush any pending debounced persistence to localStorage immediately. */
  flush(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (typeof localStorage === 'undefined') return;
    try {
      const key = `${STORAGE_PREFIX}data_${this.activeProfileId}_${this.currentYear}`;
      localStorage.setItem(key, JSON.stringify(this.data));
    } catch (err) {
      console.warn('Storage write failed or quota exceeded:', err);
    }
  }

  private save(immediate = false): void {
    if (immediate) {
      this.flush();
      return;
    }

    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      if (typeof localStorage !== 'undefined') {
        try {
          const key = `${STORAGE_PREFIX}data_${this.activeProfileId}_${this.currentYear}`;
          localStorage.setItem(key, JSON.stringify(this.data));
        } catch (err) {
          console.warn('Storage write failed or quota exceeded:', err);
        }
      }
    }, 150);
  }

  private load(profileId: string, year: FiscalYear): DeclaracionData {
    if (typeof localStorage !== 'undefined') {
      const key = `${STORAGE_PREFIX}data_${profileId}_${year}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as DeclaracionData;
          return this.mergeWithDefaults(parsed, year, profileId);
        } catch {
          return createEmptyDeclaracion(year, profileId);
        }
      }

      // Check legacy key for profile_main
      if (profileId === 'profile_main') {
        const legacyKey = `${STORAGE_PREFIX}${year}`;
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw) {
          try {
            const parsed = JSON.parse(legacyRaw) as DeclaracionData;
            return this.mergeWithDefaults(parsed, year, profileId);
          } catch {}
        }
      }
    }

    return createEmptyDeclaracion(year, profileId);
  }

  private loadProfiles(): UserProfile[] {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}profiles`);
      if (raw) {
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length > 0) {
            return arr.map(p => {
              const pType: UserType = p.type || (p.relation === 'spouse' ? 'family_member' : 'employee');
              return {
                id: p.id || `profile_${crypto.randomUUID().substring(0, 8)}`,
                name: p.name || 'Declarant',
                type: pType,
                relation: p.relation || 'other',
                nif: p.nif || '',
                email: p.email || '',
                phone: p.phone || '',
                birthDate: p.birthDate || '',
                community: p.community || 'CAT',
                status: p.status || 'draft',
                notes: p.notes || '',
                avatarColor: p.avatarColor || (
                  pType === 'freelance' ? '#10b981' :
                  pType === 'investor' ? '#a855f7' :
                  pType === 'landlord' ? '#f59e0b' :
                  pType === 'retiree' ? '#ec4899' :
                  pType === 'beckham' ? '#eab308' :
                  pType === 'family_member' ? '#f43f5e' :
                  pType === 'advisor_client' ? '#6366f1' : '#3b82f6'
                ),
                avatarIcon: p.avatarIcon || (
                  pType === 'freelance' ? '🏢' :
                  pType === 'investor' ? '📈' :
                  pType === 'landlord' ? '🏠' :
                  pType === 'retiree' ? '🏖️' :
                  pType === 'beckham' ? '🌍' :
                  pType === 'family_member' ? '👨‍👩‍👧‍👦' :
                  pType === 'advisor_client' ? '📁' : '💼'
                ),
                tags: Array.isArray(p.tags) ? p.tags : [],
                iban: p.iban || '',
                activityIAE: p.activityIAE || '',
                enabledModules: Array.isArray(p.enabledModules) && p.enabledModules.length > 0
                  ? p.enabledModules
                  : ALL_APP_MODULES.map(m => m.id),
                createdAt: p.createdAt || new Date().toISOString(),
                updatedAt: p.updatedAt || new Date().toISOString(),
              };
            });
          }
        } catch {}
      }
    }
    return [...DEFAULT_PROFILES];
  }

  private saveProfiles(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(`${STORAGE_PREFIX}profiles`, JSON.stringify(this.profiles));
  }

  private loadActiveProfileId(): string {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}active_profile_id`);
      if (stored && this.profiles.some(p => p.id === stored)) return stored;
    }
    return this.profiles[0]?.id || 'profile_main';
  }

  private loadCurrentYear(): FiscalYear {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}current_year`);
      if (stored) {
        const year = parseInt(stored, 10) as FiscalYear;
        if (FISCAL_YEARS.includes(year)) return year;
      }
    }
    return FISCAL_YEARS[FISCAL_YEARS.length - 1];
  }

  /* ── IVA Management & Synchronization ───────────────────── */

  getIVA(): IVAData {
    if (!this.data.iva) {
      this.data.iva = initializeEmptyIVAData();
    }
    return this.data.iva;
  }

  updateIVA(partial: Partial<IVAData>): void {
    if (!this.data.iva) {
      this.data.iva = initializeEmptyIVAData();
    }
    this.data.iva = { ...this.data.iva, ...partial };
    this.recalculateIVA();
    this.save();
    this.notify();
  }

  recalculateIVA(): void {
    if (!this.data.iva) return;
    const { quarters } = calculateAllQuarters(this.data.iva, this.currentYear);
    this.data.iva.quarters = quarters;
  }

  addIssuedInvoice(inv: IVAInvoiceIssued): void {
    const iva = this.getIVA();
    iva.issuedInvoices.push(inv);
    this.recalculateIVA();
    this.save();
    this.notify();
  }

  updateIssuedInvoice(inv: IVAInvoiceIssued): void {
    const iva = this.getIVA();
    const idx = iva.issuedInvoices.findIndex(i => i.id === inv.id);
    if (idx >= 0) {
      iva.issuedInvoices[idx] = inv;
      this.recalculateIVA();
      this.save();
      this.notify();
    }
  }

  deleteIssuedInvoice(id: string): void {
    const iva = this.getIVA();
    iva.issuedInvoices = iva.issuedInvoices.filter(i => i.id !== id);
    this.recalculateIVA();
    this.save();
    this.notify();
  }

  addReceivedInvoice(inv: IVAInvoiceReceived): void {
    const iva = this.getIVA();
    iva.receivedInvoices.push(inv);
    this.recalculateIVA();
    this.save();
    this.notify();
  }

  updateReceivedInvoice(inv: IVAInvoiceReceived): void {
    const iva = this.getIVA();
    const idx = iva.receivedInvoices.findIndex(i => i.id === inv.id);
    if (idx >= 0) {
      iva.receivedInvoices[idx] = inv;
      this.recalculateIVA();
      this.save();
      this.notify();
    }
  }

  deleteReceivedInvoice(id: string): void {
    const iva = this.getIVA();
    iva.receivedInvoices = iva.receivedInvoices.filter(i => i.id !== id);
    this.recalculateIVA();
    this.save();
    this.notify();
  }

  addInvestmentAsset(asset: IVABienInversion): void {
    const iva = this.getIVA();
    iva.investmentAssets.push(asset);
    this.recalculateIVA();
    this.save();
    this.notify();
  }

  updateInvestmentAsset(asset: IVABienInversion): void {
    const iva = this.getIVA();
    const idx = iva.investmentAssets.findIndex(a => a.id === asset.id);
    if (idx >= 0) {
      iva.investmentAssets[idx] = asset;
      this.recalculateIVA();
      this.save();
      this.notify();
    }
  }

  deleteInvestmentAsset(id: string): void {
    const iva = this.getIVA();
    iva.investmentAssets = iva.investmentAssets.filter(a => a.id !== id);
    this.recalculateIVA();
    this.save();
    this.notify();
  }

  syncIVAFromActivities(): { addedIssued: number; addedReceived: number } {
    const result = syncActivitiesToIVA(this.data);
    this.data.iva = result.updatedIVA;
    this.save();
    this.notify();
    return { addedIssued: result.addedIssued, addedReceived: result.addedReceived };
  }

  syncActivitiesFromIVA(): void {
    const result = syncIVAToActivities(this.data);
    this.data.activities = {
      ...this.data.activities,
      income: result.totalBaseIncome,
      expenses: result.totalBaseExpenses,
      withholdings: result.totalWithholdings,
    };
    this.save();
    this.notify();
  }

  updateComplementary(comp: Partial<ComplementaryIRPFData>): void {
    this.data.complementary = {
      isComplementary: false,
      reason: 'other_higher_tax',
      previousReceiptNumber: '',
      previousResult: 0,
      monthsLate: 0,
      hasTaxOfficeNotice: false,
      ...(this.data.complementary || {}),
      ...comp,
    };
    this.save();
    this.notify();
  }

  updateQuarterComplementary(quarter: FiscalQuarter, comp: Partial<Model303QuarterResult>): void {
    const iva = this.getIVA();
    if (!iva.quarters[quarter]) {
      this.recalculateIVA();
    }
    iva.quarters[quarter] = {
      ...iva.quarters[quarter],
      ...comp,
    };
    this.recalculateIVA();
    this.save();
    this.notify();
  }

  syncIVAFromProperties(): { addedCommercialRentals: number; addedTouristRentals: number; addedExemptRentals: number; addedInvestmentAssets: number } {
    const result = syncPropertiesToIVA(this.data);
    this.data.iva = result.updatedIVA;
    this.save();
    this.notify();
    return result;
  }

  private mergeWithDefaults(
    data: Partial<DeclaracionData>,
    year: number,
    profileId: string,
  ): DeclaracionData {
    return validateAndSanitizeDeclaration(data, year as FiscalYear, profileId);
  }

  private notify(changedSection?: keyof DeclaracionData): void {
    for (const listener of this.listeners) {
      listener();
    }
    if (changedSection) {
      const set = this.keyListeners.get(changedSection as string);
      if (set) {
        const sectionData = this.data[changedSection];
        for (const listener of set) {
          listener(sectionData);
        }
      }
    } else {
      for (const [key, set] of this.keyListeners.entries()) {
        const sectionData = (this.data as unknown as Record<string, unknown>)[key];
        for (const listener of set) {
          listener(sectionData);
        }
      }
    }
  }
}

/** Global store instance */
export const store = new Store();
