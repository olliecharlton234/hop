import { Redirect, useLocalSearchParams } from 'expo-router';
/** Deep link hop://memories/<id> → the outing (it shows as a memory once it has ended) */
export default function MemoryLink() { const { id } = useLocalSearchParams<{ id: string }>(); return <Redirect href={{ pathname: '/outings/[id]', params: { id } }} />; }
