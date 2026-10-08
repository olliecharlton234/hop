import { Redirect, useLocalSearchParams } from 'expo-router';
/** Shared link /event/<id> → the event sheet on the map */
export default function EventLink() { const { id } = useLocalSearchParams<{ id: string }>(); return <Redirect href={{ pathname: '/', params: { event: id } }} />; }
