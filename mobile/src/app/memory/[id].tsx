import { Redirect, useLocalSearchParams } from 'expo-router';
/** Shared link /memory/<id> → the outing, which shows as a memory once the night has ended */
export default function MemoryLink() { const { id } = useLocalSearchParams<{ id: string }>(); return <Redirect href={{ pathname: '/outings/[id]', params: { id } }} />; }
