import { useEffect, useState } from 'react';
import { Code2, Folder, Plus } from 'lucide-react';
import { readCollections, writeCollections, type ApiCollection, type ApiProfile } from './collections';
import { Button } from '../../shell/Button';
import './collectionOverview.css';

export function CollectionOverview({ collectionId, onOpenProfile }: {
    collectionId: string;
    onOpenProfile: (profile: ApiProfile, collectionId: string) => void;
}) {
    const [collection, setCollection] = useState<ApiCollection | undefined>(() => readCollections().find(c => c.id === collectionId));

    useEffect(() => {
        const refresh = () => setCollection(readCollections().find(c => c.id === collectionId));
        window.addEventListener('traffic-studio-collections-change', refresh);
        return () => window.removeEventListener('traffic-studio-collections-change', refresh);
    }, [collectionId]);

    if (!collection) {
        return <div className="collection-overview"><div className="no-results">This collection no longer exists.</div></div>;
    }

    function addRequest() {
        if (!collection) return;
        const item: ApiProfile = { id: crypto.randomUUID(), name: 'New request', method: 'GET', url: '', headers: [], body: '', notes: '' };
        const next = readCollections().map(c => c.id === collectionId ? { ...c, profiles: [...c.profiles, item] } : c);
        writeCollections(next);
        onOpenProfile(item, collectionId);
    }

    return <div className="collection-overview">
        <header className="collection-overview-head">
            <div>
                <Folder size={22} />
                <div>
                    <span className="eyebrow">COLLECTION</span>
                    <h1>{collection.name}</h1>
                    <p>{collection.profiles.length} request{collection.profiles.length === 1 ? '' : 's'}</p>
                </div>
            </div>
            <Button variant="default" onClick={addRequest}><Plus size={15} /> Add request</Button>
        </header>

        {collection.profiles.length > 0 ? <div className="collection-overview-list">
            {collection.profiles.map(p => <button key={p.id} className="collection-overview-row" onClick={() => onOpenProfile(p, collectionId)}>
                <span className={`method method-${p.method.toLowerCase()}`}>{p.method}</span>
                <span className="collection-overview-name">{p.name}</span>
                <span className="collection-overview-url">{p.url || 'No URL yet'}</span>
            </button>)}
        </div> : <div className="collection-overview-empty">
            <Code2 size={32} />
            <h2>No requests in this collection yet</h2>
            <p>Create the first request to start building your API collection.</p>
            <Button variant="default" onClick={addRequest}><Plus size={15} /> Add first request</Button>
        </div>}
    </div>;
}