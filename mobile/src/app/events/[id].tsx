import { Redirect, useLocalSearchParams } from 'expo-router';
/** Deep link hop://events/<id> → the event sheet on the map */
export default function EventLink() { const { id } = useLocalSearchParams<{ id: string }>(); return <Redirect href={{ pathname: '/', params: { event: id } }} />; }
